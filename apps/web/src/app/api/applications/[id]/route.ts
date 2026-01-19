import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import {
  applications,
  tasks,
  taskComments,
  taskActivityLog,
  releases,
  releaseAssets,
  appIntegrations,
  activityEvents,
  taskSyncConfigs,
  notionConfigs,
  eq,
} from "@repo/db";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/applications/[id]
 * Fetch a single application by ID or slug
 */
export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 503 }
      );
    }

    const appId = decodeURIComponent(params.id);

    // Try to find by ID first, then by slug
    let [application] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1);

    if (!application) {
      [application] = await db
        .select()
        .from(applications)
        .where(eq(applications.slug, appId))
        .limit(1);
    }

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...application,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch application:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch application",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/applications/[id]
 * Update application fields (partial update)
 */
export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 503 }
      );
    }

    const appId = decodeURIComponent(params.id);
    const body = await request.json();

    // Find the application
    let [application] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1);

    if (!application) {
      [application] = await db
        .select()
        .from(applications)
        .where(eq(applications.slug, appId))
        .limit(1);
    }

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // Build update object with allowed fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Basic fields
    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      if (body.name.length > 100) {
        return NextResponse.json(
          { success: false, error: "Name must be 100 characters or less" },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();

      // Auto-update slug if name changes (unless slug explicitly provided)
      if (body.slug === undefined) {
        updateData.slug = body.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
    }

    if (body.slug !== undefined) {
      const newSlug = body.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "");

      // Check uniqueness if slug is changing
      if (newSlug !== application.slug) {
        const [existing] = await db
          .select({ id: applications.id })
          .from(applications)
          .where(eq(applications.slug, newSlug))
          .limit(1);

        if (existing && existing.id !== application.id) {
          return NextResponse.json(
            { success: false, error: "Slug already in use" },
            { status: 400 }
          );
        }
      }
      updateData.slug = newSlug;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.repositoryUrl !== undefined) {
      updateData.repositoryUrl = body.repositoryUrl;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Provider fields
    if (body.gitProvider !== undefined) {
      updateData.gitProvider = body.gitProvider;
    }

    if (body.deployProvider !== undefined) {
      updateData.deployProvider = body.deployProvider;
    }

    if (body.dbProvider !== undefined) {
      updateData.dbProvider = body.dbProvider;
    }

    // K8s fields
    if (body.k8sNamespace !== undefined) {
      updateData.k8sNamespace = body.k8sNamespace;
    }

    if (body.k8sDeploymentName !== undefined) {
      updateData.k8sDeploymentName = body.k8sDeploymentName;
    }

    // External project IDs
    if (body.vercelProjectId !== undefined) {
      updateData.vercelProjectId = body.vercelProjectId;
    }

    if (body.expoProjectId !== undefined) {
      updateData.expoProjectId = body.expoProjectId;
    }

    if (body.productId !== undefined) {
      updateData.productId = body.productId;
    }

    // Perform update
    const [updated] = await db
      .update(applications)
      .set(updateData)
      .where(eq(applications.id, application.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to update application:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update application",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/applications/[id]
 * Full update (delegates to PATCH for backwards compatibility)
 */
export async function PUT(request: NextRequest, props: Params) {
  return PATCH(request, props);
}

/**
 * DELETE /api/applications/[id]
 * Delete an application and all related data
 */
export async function DELETE(_request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 503 }
      );
    }

    const appId = decodeURIComponent(params.id);

    // Find the application
    let [application] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1);

    if (!application) {
      [application] = await db
        .select()
        .from(applications)
        .where(eq(applications.slug, appId))
        .limit(1);
    }

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // Delete related data in order (respecting foreign keys)
    // Note: Some tables have ON DELETE CASCADE, but we'll be explicit

    // 1. Delete task-related data
    const appTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.applicationId, application.id));

    for (const task of appTasks) {
      await db.delete(taskComments).where(eq(taskComments.taskId, task.id));
      await db.delete(taskActivityLog).where(eq(taskActivityLog.taskId, task.id));
    }
    await db.delete(tasks).where(eq(tasks.applicationId, application.id));

    // 2. Delete releases and release assets
    const appReleases = await db
      .select({ id: releases.id })
      .from(releases)
      .where(eq(releases.applicationId, application.id));

    for (const release of appReleases) {
      await db.delete(releaseAssets).where(eq(releaseAssets.releaseId, release.id));
    }
    await db.delete(releases).where(eq(releases.applicationId, application.id));

    // 3. Delete app integrations
    await db.delete(appIntegrations).where(eq(appIntegrations.applicationId, application.id));

    // 4. Delete task sync configs
    await db.delete(taskSyncConfigs).where(eq(taskSyncConfigs.applicationId, application.id));

    // 5. Delete notion configs
    await db.delete(notionConfigs).where(eq(notionConfigs.applicationId, application.id));

    // 6. Delete activity events (optional - they reference appId)
    await db.delete(activityEvents).where(eq(activityEvents.appId, application.id));

    // 7. Finally delete the application
    await db.delete(applications).where(eq(applications.id, application.id));

    return NextResponse.json({
      success: true,
      message: `Application "${application.name}" deleted successfully`,
    });
  } catch (error) {
    console.error("Failed to delete application:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete application",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
