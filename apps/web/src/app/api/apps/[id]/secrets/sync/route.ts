import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  syncSecretsToK8s,
  syncSecretsToGitea,
} from "@/lib/provisioning/secrets-service";
import { getPostgresDb, schemaPg } from "@/lib/db/postgres";
import { eq } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/apps/[id]/secrets/sync
 * Sync secrets to Kubernetes and/or Gitea
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: applicationId } = await context.params;
    const body = await request.json();
    const { 
      targets = ["k8s"], // "k8s", "gitea", or both
      environment = "production",
    } = body;

    // Verify app exists and get slug
    const db = await getPostgresDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const [app] = await db
      .select({ 
        id: schemaPg.applications.id, 
        slug: schemaPg.applications.slug,
        repositoryFullName: schemaPg.applications.repositoryFullName,
      })
      .from(schemaPg.applications)
      .where(eq(schemaPg.applications.id, applicationId));

    if (!app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const results: { k8s?: { success: boolean; message: string }; gitea?: { success: boolean; message: string } } = {};

    // Sync to Kubernetes
    if (targets.includes("k8s")) {
      try {
        const namespace = `${app.slug}-${environment}`;
        const k8sResult = await syncSecretsToK8s(applicationId, namespace, environment);
        results.k8s = {
          success: k8sResult.success,
          message: k8sResult.message,
        };
      } catch (error) {
        results.k8s = {
          success: false,
          message: error instanceof Error ? error.message : "K8s sync failed",
        };
      }
    }

    // Sync to Gitea
    if (targets.includes("gitea")) {
      try {
        if (!app.repositoryFullName) {
          results.gitea = {
            success: false,
            message: "No repository configured for this application",
          };
        } else {
          const giteaResult = await syncSecretsToGitea(applicationId, app.repositoryFullName);
          results.gitea = {
            success: giteaResult.success,
            message: giteaResult.message,
          };
        }
      } catch (error) {
        results.gitea = {
          success: false,
          message: error instanceof Error ? error.message : "Gitea sync failed",
        };
      }
    }

    const allSuccess = Object.values(results).every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      results,
      message: allSuccess 
        ? "Secrets synced successfully" 
        : "Some sync operations failed",
    });
  } catch (error) {
    console.error("Error syncing secrets:", error);
    return NextResponse.json(
      { error: "Failed to sync secrets" },
      { status: 500 }
    );
  }
}
