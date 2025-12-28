import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/[id]/images
 * 
 * Returns container images for an application from Harbor registry
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    // Extract app name from appId (could be "owner/repo" format)
    const appName = appId.includes("/") ? (appId.split("/")[1] ?? appId) : appId;
    
    const images = await unifiedAppService.getContainerImages(appName);
    
    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
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
