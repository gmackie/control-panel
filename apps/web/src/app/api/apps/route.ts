import { NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { applications, desc } from "@repo/db";

/**
 * GET /api/apps
 * 
 * Returns list of all applications from the database
 * 
 * TODO: Add Gitea, K8s, and Harbor integration when needed
 */
export async function GET() {
  try {
    const db = await getDbAsync();
    
    if (!db) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: "Database not available",
      });
    }
    
    const apps = await db
      .select()
      .from(applications)
      .orderBy(desc(applications.createdAt));
    
    const formattedApps = apps.map(app => ({
      ...app,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedApps,
      count: formattedApps.length,
    });
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch applications",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
