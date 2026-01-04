/**
 * Linear Webhook Handler
 * 
 * Receives webhooks from Linear for issues (and other entities),
 * syncing them to the local task table in real-time.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, eq, and } from '@repo/db';
import { tasks, taskSyncConfigs, taskActivityLog, applications } from '@repo/db';
import type {
  LinearWebhookPayload,
  LinearIssue,
  WebhookResult,
} from '@/lib/webhooks/types';
import {
  isLinearIssueEvent,
  mapLinearStateToStatus,
  mapLinearPriorityToPriority,
} from '@/lib/webhooks/types';

const LINEAR_WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET;

/**
 * Verify Linear webhook signature
 * Linear uses HMAC-SHA256 with the raw body and signing secret
 */
function verifyLinearSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Find application by Linear team ID
 */
async function findApplicationByTeam(
  teamId: string
): Promise<{ applicationId: string; config: Record<string, unknown> } | null> {
  // Look for task sync configs with linear provider that match this team
  const configs = await db
    .select({
      config: taskSyncConfigs,
      app: applications,
    })
    .from(taskSyncConfigs)
    .innerJoin(applications, eq(applications.id, taskSyncConfigs.applicationId))
    .where(
      and(
        eq(taskSyncConfigs.provider, 'linear'),
        eq(taskSyncConfigs.enabled, true)
      )
    );

  for (const { config, app } of configs) {
    if (!config.config) continue;
    
    try {
      const providerConfig = JSON.parse(config.config) as { teamId: string; projectId?: string };
      if (providerConfig.teamId === teamId) {
        return {
          applicationId: app.id,
          config: providerConfig,
        };
      }
    } catch {
      // Invalid config JSON, skip
    }
  }

  return null;
}

/**
 * Process Linear issue event
 */
async function processIssueEvent(
  issue: LinearIssue,
  action: 'create' | 'update' | 'remove',
  applicationId: string
): Promise<{ created: number; updated: number }> {
  const issueId = issue.id;

  // Find existing task by Linear link
  const existingTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.applicationId, applicationId));

  let existingTask = null;
  for (const task of existingTasks) {
    if (task.linearLink) {
      try {
        const link = JSON.parse(task.linearLink);
        if (link.id === issueId) {
          existingTask = task;
          break;
        }
      } catch {
        // Invalid link JSON
      }
    }
    // Also check sourceId
    if (task.sourceProvider === 'linear' && task.sourceId === issueId) {
      existingTask = task;
      break;
    }
  }

  const now = new Date();
  const linearLink = JSON.stringify({
    id: issue.id,
    identifier: issue.identifier,
    url: issue.url,
  });

  // Handle remove action
  if (action === 'remove') {
    if (existingTask) {
      await db
        .update(tasks)
        .set({
          syncStatus: 'externally_deleted',
          updatedAt: now,
        })
        .where(eq(tasks.id, existingTask.id));

      await db.insert(taskActivityLog).values({
        taskId: existingTask.id,
        action: 'status_changed',
        field: 'syncStatus',
        oldValue: existingTask.syncStatus,
        newValue: 'externally_deleted',
        actorType: 'sync',
        source: 'linear',
      });
    }
    return { created: 0, updated: existingTask ? 1 : 0 };
  }

  // Extract task data from issue
  const taskData = {
    title: issue.title,
    description: issue.description || null,
    status: mapLinearStateToStatus(issue.state.type),
    priority: mapLinearPriorityToPriority(issue.priority) || null,
    labels: issue.labels.length > 0 ? JSON.stringify(issue.labels.map(l => l.name)) : null,
    assignee: issue.assignee?.name || null,
    linearLink,
    syncStatus: 'synced' as const,
    lastSyncAt: now,
    updatedAt: now,
    closedAt: issue.completedAt ? new Date(issue.completedAt) : 
              issue.canceledAt ? new Date(issue.canceledAt) : null,
  };

  if (existingTask) {
    // Update existing task
    await db
      .update(tasks)
      .set(taskData)
      .where(eq(tasks.id, existingTask.id));

    await db.insert(taskActivityLog).values({
      taskId: existingTask.id,
      action: 'updated',
      actorType: 'sync',
      source: 'linear',
      newValue: JSON.stringify({ action, identifier: issue.identifier }),
    });

    return { created: 0, updated: 1 };
  } else if (action === 'create' || action === 'update') {
    // Create new task
    const [newTask] = await db
      .insert(tasks)
      .values({
        ...taskData,
        applicationId,
        sourceProvider: 'linear',
        sourceId: issueId,
        createdAt: now,
      })
      .returning();

    await db.insert(taskActivityLog).values({
      taskId: newTask.id,
      action: 'created',
      actorType: 'sync',
      source: 'linear',
      newValue: JSON.stringify({ action, identifier: issue.identifier }),
    });

    return { created: 1, updated: 0 };
  }

  return { created: 0, updated: 0 };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  
  // Verify signature
  if (LINEAR_WEBHOOK_SECRET) {
    const signature = request.headers.get('linear-signature');
    
    if (!verifyLinearSignature(body, signature, LINEAR_WEBHOOK_SECRET)) {
      console.error('Linear webhook signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
  }

  // Parse payload
  let payload: LinearWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  // Only process Issue events for now
  if (!isLinearIssueEvent(payload)) {
    return NextResponse.json({
      received: true,
      processed: false,
      reason: `Event type ${payload.type} not supported`,
    });
  }

  // Extract issue data
  const issue = payload.data as LinearIssue;
  
  if (!issue.team) {
    return NextResponse.json({
      received: true,
      processed: false,
      reason: 'No team in issue data',
    });
  }

  // Find application for this team
  const appInfo = await findApplicationByTeam(issue.team.id);

  if (!appInfo) {
    return NextResponse.json({
      received: true,
      processed: false,
      reason: 'Team not configured for sync',
    });
  }

  const result: WebhookResult = {
    success: true,
    processed: true,
    tasksCreated: 0,
    tasksUpdated: 0,
    releasesCreated: 0,
    releasesUpdated: 0,
  };

  try {
    const issueResult = await processIssueEvent(
      issue,
      payload.action,
      appInfo.applicationId
    );
    result.tasksCreated = issueResult.created;
    result.tasksUpdated = issueResult.updated;

    // Update sync config last sync time
    await db
      .update(taskSyncConfigs)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskSyncConfigs.applicationId, appInfo.applicationId),
          eq(taskSyncConfigs.provider, 'linear')
        )
      );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Linear webhook processing error:', error);

    // Update sync config with error
    await db
      .update(taskSyncConfigs)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskSyncConfigs.applicationId, appInfo.applicationId),
          eq(taskSyncConfigs.provider, 'linear')
        )
      );

    return NextResponse.json(
      {
        ...result,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'Linear webhook endpoint ready',
    configured: !!LINEAR_WEBHOOK_SECRET,
    events: ['Issue'],
  });
}
