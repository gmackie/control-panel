import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/[id]/pull-requests
 * 
 * Returns pull requests for an application
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state") as "open" | "closed" | "all" || "open";
    
    const pullRequests = await unifiedAppService.getPullRequests(appId, state);
    
    return NextResponse.json({
      success: true,
      data: pullRequests,
      count: pullRequests.length,
    });
  } catch (error) {
    console.error("Failed to fetch pull requests:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch pull requests",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
