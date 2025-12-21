import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * POST /api/apps/sync
 * 
 * Sync all applications from Gitea to PostgreSQL
 * This discovers apps from Gitea and creates/updates records in the database
 */
export async function POST(_request: NextRequest) {
  try {
    const result = await unifiedAppService.syncAllApplications();
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `Synced ${result.synced} applications, ${result.failed} failed`,
    });
  } catch (error) {
    console.error("Failed to sync applications:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to sync applications",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
