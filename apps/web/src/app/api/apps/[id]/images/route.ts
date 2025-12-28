import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/apps/[id]/images
 * 
 * Returns container images for an application from Harbor registry
 * TODO: Implement with Harbor API when needed
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    // Extract app name from appId (could be "owner/repo" format)
    const appName = appId.includes("/") ? (appId.split("/")[1] ?? appId) : appId;
    
    // Return empty array - Harbor integration not yet implemented
    const images: Array<{
      name: string;
      tag: string;
      digest: string;
      size: number;
      createdAt: string;
    }> = [];
    
    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
      appName,
    });
  } catch (error) {
    console.error("Failed to fetch container images:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch container images",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
