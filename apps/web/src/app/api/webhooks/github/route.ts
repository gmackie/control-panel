/**
 * GitHub Webhook Handler
 * 
 * Receives webhooks from GitHub for issues and releases,
 * syncing them to the local task and release tables in real-time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and } from '@repo/db';
import { tasks, releases, taskSyncConfigs, taskActivityLog, applications } from '@repo/db';
import { verifyHmacSha256Signature } from '@/lib/webhooks/signature-verification';
import type {
  GitHubIssuesEvent,
  GitHubIssueCommentEvent,
  GitHubReleaseEvent,
  WebhookResult,
} from '@/lib/webhooks/types';
import {
  isGitHubIssuesEvent,
  isGitHubReleaseEvent,
  mapIssueStateToStatus,
  mapLabelsToFriority,
} from '@/lib/webhooks/types';

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Find application by repository full_name (owner/repo)
 */
async function findApplicationByRepo(
  owner: string,
  repo: string
): Promise<{ applicationId: string; config: Record<string, unknown> } | null> {
  // Look for task sync configs with github provider that match this repo
  const configs = await db
    .select({
      config: taskSyncConfigs,
      app: applications,
    })
    .from(taskSyncConfigs)
    .innerJoin(applications, eq(applications.id, taskSyncConfigs.applicationId))
    .where(
      and(
        eq(taskSyncConfigs.provider, 'github'),
        eq(taskSyncConfigs.enabled, true)
      )
    );

  for (const { config, app } of configs) {
    if (!config.config) continue;
    
    try {
      const providerConfig = JSON.parse(config.config) as { owner: string; repo: string };
      if (
        providerConfig.owner?.toLowerCase() === owner.toLowerCase() &&
        providerConfig.repo?.toLowerCase() === repo.toLowerCase()
      ) {
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
 * Process GitHub issue event
 */
async function processIssueEvent(
  event: GitHubIssuesEvent,
  applicationId: string
): Promise<{ created: number; updated: number }> {
  const { action, issue, repository } = event;
  const issueNumber = String(issue.number);

  // Find existing task by GitHub link
  const existingTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.applicationId, applicationId));

  let existingTask = null;
  for (const task of existingTasks) {
    if (task.githubLink) {
      try {
        const link = JSON.parse(task.githubLink);
        if (String(link.number) === issueNumber) {
          existingTask = task;
          break;
        }
      } catch {
        // Invalid link JSON
      }
    }
    // Also check sourceId
    if (task.sourceProvider === 'github' && task.sourceId === issueNumber) {
      existingTask = task;
      break;
    }
  }

  const now = new Date();
  const githubLink = JSON.stringify({
    owner: repository.owner.login,
    repo: repository.name,
    number: issue.number,
    url: issue.html_url,
  });

  // Handle delete action
  if (action === 'deleted') {
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
        source: 'github',
      });
    }
    return { created: 0, updated: existingTask ? 1 : 0 };
  }

  // Extract task data from issue
  const taskData = {
    title: issue.title,
    description: issue.body || null,
    status: mapIssueStateToStatus(issue.state),
    priority: mapLabelsToFriority(issue.labels) || null,
    labels: issue.labels.length > 0 ? JSON.stringify(issue.labels.map(l => l.name)) : null,
    assignee: issue.assignee?.login || null,
    githubLink,
    syncStatus: 'synced' as const,
    lastSyncAt: now,
    updatedAt: now,
    closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
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
      source: 'github',
      newValue: JSON.stringify({ action, issue_number: issue.number }),
    });

    return { created: 0, updated: 1 };
  } else if (action === 'opened' || action === 'edited' || action === 'reopened') {
    // Create new task
    const [newTask] = await db
      .insert(tasks)
      .values({
        ...taskData,
        applicationId,
        sourceProvider: 'github',
        sourceId: issueNumber,
        createdAt: now,
      })
      .returning();

    await db.insert(taskActivityLog).values({
      taskId: newTask.id,
      action: 'created',
      actorType: 'sync',
      source: 'github',
      newValue: JSON.stringify({ action, issue_number: issue.number }),
    });

    return { created: 1, updated: 0 };
  }

  return { created: 0, updated: 0 };
}

/**
 * Process GitHub release event
 */
async function processReleaseEvent(
  event: GitHubReleaseEvent,
  applicationId: string
): Promise<{ created: number; updated: number }> {
  const { action, release: githubRelease, repository } = event;
  const releaseId = String(githubRelease.id);

  // Find existing release by GitHub release data
  const existingReleases = await db
    .select()
    .from(releases)
    .where(eq(releases.applicationId, applicationId));

  let existingRelease = null;
  for (const release of existingReleases) {
    if (release.githubRelease) {
      try {
        const link = JSON.parse(release.githubRelease);
        if (String(link.releaseId) === releaseId) {
          existingRelease = release;
          break;
        }
      } catch {
        // Invalid link JSON
      }
    }
    // Also check by tag name
    if (release.tagName === githubRelease.tag_name) {
      existingRelease = release;
      break;
    }
  }

  const now = new Date();
  const githubReleaseLink = JSON.stringify({
    published: !githubRelease.draft,
    releaseId: githubRelease.id,
    url: githubRelease.html_url,
    publishedAt: githubRelease.published_at,
  });

  // Handle delete action
  if (action === 'deleted') {
    if (existingRelease) {
      // We don't actually delete, just mark the github link as deleted
      await db
        .update(releases)
        .set({
          githubRelease: JSON.stringify({
            ...JSON.parse(existingRelease.githubRelease || '{}'),
            deleted: true,
          }),
          updatedAt: now,
        })
        .where(eq(releases.id, existingRelease.id));
    }
    return { created: 0, updated: existingRelease ? 1 : 0 };
  }

  // Extract release data
  const releaseData = {
    version: githubRelease.tag_name.replace(/^v/, ''), // Remove leading 'v' if present
    name: githubRelease.name || undefined,
    changelog: githubRelease.body || undefined,
    status: githubRelease.draft ? 'draft' : 'published',
    tagName: githubRelease.tag_name,
    targetBranch: githubRelease.target_commitish,
    isPrerelease: githubRelease.prerelease,
    githubRelease: githubReleaseLink,
    publishedAt: githubRelease.published_at ? new Date(githubRelease.published_at) : undefined,
    updatedAt: now,
  };

  if (existingRelease) {
    // Update existing release
    await db
      .update(releases)
      .set(releaseData)
      .where(eq(releases.id, existingRelease.id));

    return { created: 0, updated: 1 };
  } else if (action === 'published' || action === 'created' || action === 'prereleased') {
    // Create new release
    await db
      .insert(releases)
      .values({
        ...releaseData,
        applicationId,
        createdAt: now,
      });

    return { created: 1, updated: 0 };
  }

  return { created: 0, updated: 0 };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  
  // Verify signature
  if (GITHUB_WEBHOOK_SECRET) {
    const signature = request.headers.get('x-hub-signature-256');
    const verification = verifyHmacSha256Signature(
      body,
      signature || '',
      GITHUB_WEBHOOK_SECRET
    );

    if (!verification.valid) {
      console.error('GitHub webhook signature verification failed:', verification.error);
      return NextResponse.json(
        { error: 'Invalid signature', details: verification.error },
        { status: 401 }
      );
    }
  }

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  // Determine event type from header
  const eventType = request.headers.get('x-github-event');
  
  if (!eventType) {
    return NextResponse.json(
      { error: 'Missing X-GitHub-Event header' },
      { status: 400 }
    );
  }

  // Extract repository info
  const repository = payload.repository as { owner: { login: string }; name: string } | undefined;
  if (!repository) {
    return NextResponse.json({
      received: true,
      processed: false,
      reason: 'No repository in payload',
    });
  }

  // Find application for this repo
  const appInfo = await findApplicationByRepo(
    repository.owner.login,
    repository.name
  );

  if (!appInfo) {
    return NextResponse.json({
      received: true,
      processed: false,
      reason: 'Repository not configured for sync',
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
    // Handle different event types
    // Cast to unknown first for proper type narrowing
    const webhookPayload = payload as unknown;
    
    if (eventType === 'issues' && isGitHubIssuesEvent(webhookPayload as GitHubIssuesEvent)) {
      const issueResult = await processIssueEvent(
        webhookPayload as GitHubIssuesEvent,
        appInfo.applicationId
      );
      result.tasksCreated = issueResult.created;
      result.tasksUpdated = issueResult.updated;
    } else if (eventType === 'release' && isGitHubReleaseEvent(webhookPayload as GitHubReleaseEvent)) {
      const releaseResult = await processReleaseEvent(
        webhookPayload as GitHubReleaseEvent,
        appInfo.applicationId
      );
      result.releasesCreated = releaseResult.created;
      result.releasesUpdated = releaseResult.updated;
    } else if (eventType === 'issue_comment') {
      // Issue comments could trigger updates but we skip for now
      result.processed = false;
    } else {
      // Unhandled event type
      result.processed = false;
    }

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
          eq(taskSyncConfigs.provider, 'github')
        )
      );

    return NextResponse.json(result);
  } catch (error) {
    console.error('GitHub webhook processing error:', error);

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
          eq(taskSyncConfigs.provider, 'github')
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
    message: 'GitHub webhook endpoint ready',
    configured: !!GITHUB_WEBHOOK_SECRET,
    events: ['issues', 'release'],
  });
}
