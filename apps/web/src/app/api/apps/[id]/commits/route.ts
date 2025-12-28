import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/apps/[id]/commits
 * 
 * Returns commit history for an application with CI/CD status
 * TODO: Implement with Gitea API when needed
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    
    // Return empty array - Gitea integration not yet implemented
    const commits: Array<{
      sha: string;
      message: string;
      author: string;
      date: string;
      pipelineStatus?: string;
    }> = [];
    
    return NextResponse.json({
      success: true,
      data: commits,
      count: commits.length,
      appId,
      limit,
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
