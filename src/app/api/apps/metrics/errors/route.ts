import { NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/metrics/errors
 * 
 * Returns error metrics from Sentry (global across all apps)
 */
export async function GET() {
  try {
    const metrics = await unifiedAppService.getErrorMetrics();
    
    if (!metrics) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "Sentry integration not configured",
      });
    }
    
    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Failed to fetch error metrics:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch error metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
