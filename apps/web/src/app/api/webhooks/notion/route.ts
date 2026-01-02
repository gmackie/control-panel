import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDbAsync, notionConfigs, notionTaskLinks, notionSyncLogs, eq } from "@repo/db";
import { notionService, type NotionTask } from "@/lib/notion/client";

const NOTION_WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET;

interface NotionWebhookPayload {
  type: string;
  database_id?: string;
  page_id?: string;
  timestamp: string;
  data?: {
    id: string;
    properties?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

function verifyNotionSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    );
  } catch {
    return false;
  }
}

async function processPageUpdate(
  db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>,
  pageId: string,
  databaseId: string
): Promise<{ created: number; updated: number }> {
  const config = await db
    .select()
    .from(notionConfigs)
    .where(eq(notionConfigs.notionDatabaseId, databaseId))
    .limit(1);

  if (!config[0] || !config[0].syncEnabled) {
    return { created: 0, updated: 0 };
  }

  let task: NotionTask;
  try {
    task = await notionService.getTask(pageId);
  } catch (error) {
    console.error(`Failed to fetch Notion page ${pageId}:`, error);
    return { created: 0, updated: 0 };
  }

  const existing = await db
    .select()
    .from(notionTaskLinks)
    .where(eq(notionTaskLinks.notionPageId, pageId))
    .limit(1);

  const now = new Date();
  const taskData = {
    notionPageId: task.notionPageId,
    notionDatabaseId: databaseId,
    applicationId: config[0].applicationId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    assignee: task.assignee,
    tags: task.tags ? JSON.stringify(task.tags) : null,
    notionUrl: task.url,
    notionCreatedAt: new Date(task.createdAt),
    notionUpdatedAt: new Date(task.updatedAt),
    rawProperties: JSON.stringify(task.properties),
    lastSyncAt: now,
    updatedAt: now,
  };

  if (existing[0]) {
    await db
      .update(notionTaskLinks)
      .set(taskData)
      .where(eq(notionTaskLinks.notionPageId, pageId));
    return { created: 0, updated: 1 };
  }

  await db.insert(notionTaskLinks).values({
    ...taskData,
    createdAt: now,
  });
  return { created: 1, updated: 0 };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  
  if (NOTION_WEBHOOK_SECRET) {
    const signature = request.headers.get("x-notion-signature");
    if (!verifyNotionSignature(body, signature, NOTION_WEBHOOK_SECRET)) {
      console.error("Notion webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: NotionWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const db = await getDbAsync();
  if (!db) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const databaseId = payload.database_id || payload.data?.id;
  if (!databaseId) {
    return NextResponse.json({ received: true, processed: false, reason: "No database_id" });
  }

  const config = await db
    .select()
    .from(notionConfigs)
    .where(eq(notionConfigs.notionDatabaseId, databaseId))
    .limit(1);

  if (!config[0]) {
    return NextResponse.json({ received: true, processed: false, reason: "Unknown database" });
  }

  const syncLog = await db.insert(notionSyncLogs).values({
    configId: config[0].id,
    syncType: "webhook",
    status: "started",
    startedAt: new Date(),
  }).returning();

  let tasksCreated = 0;
  let tasksUpdated = 0;
  let errorMessage: string | undefined;

  try {
    if (payload.type === "page.created" || payload.type === "page.updated") {
      const pageId = payload.page_id || payload.data?.id;
      if (pageId) {
        const result = await processPageUpdate(db, pageId, databaseId);
        tasksCreated = result.created;
        tasksUpdated = result.updated;
      }
    } else if (payload.type === "database.updated") {
      const syncResult = await notionService.syncActiveTasks(databaseId);
      
      for (const task of syncResult.tasks) {
        const result = await processPageUpdate(db, task.notionPageId, databaseId);
        tasksCreated += result.created;
        tasksUpdated += result.updated;
      }
    }

    const now = new Date();
    await db
      .update(notionSyncLogs)
      .set({
        status: "success",
        tasksCreated,
        tasksUpdated,
        completedAt: now,
        durationMs: now.getTime() - new Date(syncLog[0].startedAt).getTime(),
      })
      .where(eq(notionSyncLogs.id, syncLog[0].id));

    await db
      .update(notionConfigs)
      .set({
        lastSyncAt: now,
        lastSyncStatus: "success",
        lastSyncError: null,
        updatedAt: now,
      })
      .where(eq(notionConfigs.id, config[0].id));

    return NextResponse.json({
      received: true,
      processed: true,
      tasksCreated,
      tasksUpdated,
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Notion webhook processing error:", error);

    const now = new Date();
    await db
      .update(notionSyncLogs)
      .set({
        status: "failed",
        errorMessage,
        completedAt: now,
        durationMs: now.getTime() - new Date(syncLog[0].startedAt).getTime(),
      })
      .where(eq(notionSyncLogs.id, syncLog[0].id));

    await db
      .update(notionConfigs)
      .set({
        lastSyncAt: now,
        lastSyncStatus: "failed",
        lastSyncError: errorMessage,
        updatedAt: now,
      })
      .where(eq(notionConfigs.id, config[0].id));

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "Notion webhook endpoint ready",
    configured: !!NOTION_WEBHOOK_SECRET,
  });
}
