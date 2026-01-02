import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notionService } from "@/lib/notion/client";
import { db } from "@repo/db";
import { notionConfigs, notionTaskLinks, desc, eq } from "@repo/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "dashboard";

    switch (action) {
      case "health": {
        const healthy = await notionService.healthCheck();
        return NextResponse.json({ healthy, service: "notion" });
      }

      case "stats": {
        const allTasks = await db.select().from(notionTaskLinks);
        
        const byStatus = {
          not_started: allTasks.filter(t => t.status === "not_started").length,
          in_progress: allTasks.filter(t => t.status === "in_progress").length,
          done: allTasks.filter(t => t.status === "done").length,
          blocked: allTasks.filter(t => t.status === "blocked").length,
          cancelled: allTasks.filter(t => t.status === "cancelled").length,
        };
        
        const withAiSession = allTasks.filter(t => t.aiSessionId !== null).length;
        const withPR = allTasks.filter(t => t.prNumber !== null).length;
        
        return NextResponse.json({
          total: allTasks.length,
          byStatus,
          withAiSession,
          withPR,
          completionRate: allTasks.length > 0 
            ? Math.round((byStatus.done / allTasks.length) * 100) 
            : 0,
        });
      }

      case "tasks": {
        const limit = parseInt(searchParams.get("limit") || "20");
        const tasks = await db
          .select()
          .from(notionTaskLinks)
          .orderBy(desc(notionTaskLinks.updatedAt))
          .limit(limit);
        return NextResponse.json({ tasks });
      }

      case "configs": {
        const configs = await db
          .select()
          .from(notionConfigs)
          .orderBy(desc(notionConfigs.createdAt));
        return NextResponse.json({ configs });
      }

      case "databases": {
        const query = searchParams.get("query") || undefined;
        const databases = await notionService.listDatabases(query);
        return NextResponse.json({ databases });
      }

      case "dashboard": {
        // Get all data for dashboard in one call
        const [allTasks, configs] = await Promise.all([
          db.select().from(notionTaskLinks).orderBy(desc(notionTaskLinks.updatedAt)),
          db.select().from(notionConfigs).orderBy(desc(notionConfigs.createdAt)),
        ]);

        const byStatus = {
          not_started: allTasks.filter(t => t.status === "not_started").length,
          in_progress: allTasks.filter(t => t.status === "in_progress").length,
          done: allTasks.filter(t => t.status === "done").length,
          blocked: allTasks.filter(t => t.status === "blocked").length,
          cancelled: allTasks.filter(t => t.status === "cancelled").length,
        };

        const withAiSession = allTasks.filter(t => t.aiSessionId !== null).length;
        const withPR = allTasks.filter(t => t.prNumber !== null).length;

        return NextResponse.json({
          stats: {
            total: allTasks.length,
            byStatus,
            withAiSession,
            withPR,
            completionRate: allTasks.length > 0 
              ? Math.round((byStatus.done / allTasks.length) * 100) 
              : 0,
          },
          recentTasks: allTasks.slice(0, 20),
          configs,
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, databaseId, configId, pageId } = body;

    switch (action) {
      case "sync": {
        // Get all configs or specific config
        let configsToSync;
        if (configId) {
          configsToSync = await db
            .select()
            .from(notionConfigs)
            .where(eq(notionConfigs.id, configId));
        } else {
          configsToSync = await db
            .select()
            .from(notionConfigs)
            .where(eq(notionConfigs.syncEnabled, true));
        }

        if (configsToSync.length === 0) {
          return NextResponse.json({ 
            error: "No configs to sync",
            synced: 0 
          }, { status: 400 });
        }

        const results = [];
        for (const config of configsToSync) {
          try {
            const syncResult = await notionService.syncTasks(config.notionDatabaseId);
            
            // Upsert tasks
            for (const task of syncResult.tasks) {
              const existing = await db
                .select()
                .from(notionTaskLinks)
                .where(eq(notionTaskLinks.notionPageId, task.notionPageId))
                .limit(1);

              const now = new Date();
              const taskData = {
                notionPageId: task.notionPageId,
                notionDatabaseId: config.notionDatabaseId,
                applicationId: config.applicationId,
                title: task.title,
                status: task.status,
                priority: task.priority || null,
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                assignee: task.assignee || null,
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
                  .where(eq(notionTaskLinks.notionPageId, task.notionPageId));
              } else {
                await db.insert(notionTaskLinks).values({
                  ...taskData,
                  createdAt: now,
                });
              }
            }

            // Update config sync status
            await db
              .update(notionConfigs)
              .set({
                lastSyncAt: new Date(),
                lastSyncStatus: "success",
                lastSyncError: null,
                updatedAt: new Date(),
              })
              .where(eq(notionConfigs.id, config.id));

            results.push({
              configId: config.id,
              databaseName: config.notionDatabaseName,
              tasksCount: syncResult.tasks.length,
              status: "success",
            });
          } catch (err) {
            // Update config with error status
            await db
              .update(notionConfigs)
              .set({
                lastSyncAt: new Date(),
                lastSyncStatus: "failed",
                lastSyncError: err instanceof Error ? err.message : "Unknown error",
                updatedAt: new Date(),
              })
              .where(eq(notionConfigs.id, config.id));

            results.push({
              configId: config.id,
              databaseName: config.notionDatabaseName,
              status: "failed",
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return NextResponse.json({
          synced: results.filter(r => r.status === "success").length,
          failed: results.filter(r => r.status === "failed").length,
          results,
        });
      }

      case "connect-database": {
        if (!databaseId) {
          return NextResponse.json({ error: "databaseId required" }, { status: 400 });
        }

        const database = await notionService.getDatabase(databaseId);
        
        return NextResponse.json({
          database,
          message: "Database retrieved. Use tRPC to create config.",
        });
      }

      case "update-task-status": {
        if (!pageId || !body.status) {
          return NextResponse.json({ error: "pageId and status required" }, { status: 400 });
        }

        const task = await notionService.updateTaskStatus(pageId, body.status);
        
        // Also update local record
        await db
          .update(notionTaskLinks)
          .set({
            status: body.status,
            updatedAt: new Date(),
          })
          .where(eq(notionTaskLinks.notionPageId, pageId));

        return NextResponse.json({ task });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
