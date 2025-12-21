import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/[id]/commits
 * 
 * Returns commit history for an application with CI/CD status
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    
    const commits = await unifiedAppService.getCommits(appId, limit);
    
    return NextResponse.json({
      success: true,
      data: commits,
      count: commits.length,
    });
  } catch (error) {
    console.error("Failed to fetch commits:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch commits",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
