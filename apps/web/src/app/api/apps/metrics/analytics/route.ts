import { NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/metrics/analytics
 * 
 * Returns analytics metrics from PostHog (global across all apps)
 */
export async function GET() {
  try {
    const metrics = await unifiedAppService.getAnalyticsMetrics();
    
    if (!metrics) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "PostHog integration not configured",
      });
    }
    
    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Failed to fetch analytics metrics:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch analytics metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
