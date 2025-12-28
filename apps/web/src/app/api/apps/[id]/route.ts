import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { applications, eq } from "@repo/db";

/**
 * GET /api/apps/[id]
 * 
 * Returns full details for a single application including:
 * - Basic app info from database
 * 
 * TODO: Add Gitea, K8s, and Harbor integration when needed
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Decode the ID (could be "owner/repo" format)
    const appId = decodeURIComponent(params.id);
    
    const db = await getDbAsync();
    
    if (!db) {
      return NextResponse.json(
        { 
          success: false,
          error: "Database not available",
        },
        { status: 503 }
      );
    }
    
    const [application] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1);
    
    if (!application) {
      // Try to find by slug
      const [appBySlug] = await db
        .select()
        .from(applications)
        .where(eq(applications.slug, appId))
        .limit(1);
      
      if (!appBySlug) {
        return NextResponse.json(
          { 
            success: false,
            error: "Application not found",
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: {
          ...appBySlug,
          createdAt: appBySlug.createdAt.toISOString(),
          updatedAt: appBySlug.updatedAt.toISOString(),
        },
      });
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
