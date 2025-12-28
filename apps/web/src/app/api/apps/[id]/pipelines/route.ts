import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/apps/[id]/pipelines
 * 
 * Returns CI/CD pipeline runs for an application
 * TODO: Implement with Gitea Actions API when needed
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    
    // Return empty array - Gitea Actions integration not yet implemented
    const pipelines: Array<{
      id: string;
      name: string;
      status: string;
      conclusion: string;
      startedAt: string;
      completedAt?: string;
    }> = [];
    
    return NextResponse.json({
      success: true,
      data: pipelines,
      count: pipelines.length,
      appId,
      limit,
    });
  } catch (error) {
    console.error("Failed to fetch pipelines:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch pipelines",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
