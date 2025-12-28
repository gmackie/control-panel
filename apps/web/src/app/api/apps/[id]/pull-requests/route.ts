import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/apps/[id]/pull-requests
 * 
 * Returns pull requests for an application
 * TODO: Implement with Gitea API when needed
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state") as "open" | "closed" | "all" || "open";
    
    // Return empty array - Gitea integration not yet implemented
    const pullRequests: Array<{
      id: number;
      number: number;
      title: string;
      state: string;
      author: string;
      createdAt: string;
      updatedAt: string;
    }> = [];
    
    return NextResponse.json({
      success: true,
      data: pullRequests,
      count: pullRequests.length,
      appId,
      state,
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
