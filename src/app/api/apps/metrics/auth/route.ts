import { NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/metrics/auth
 * 
 * Returns auth metrics from Clerk (global across all apps)
 */
export async function GET() {
  try {
    const metrics = await unifiedAppService.getAuthMetrics();
    
    if (!metrics) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "Clerk integration not configured",
      });
    }
    
    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Failed to fetch auth metrics:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch auth metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
