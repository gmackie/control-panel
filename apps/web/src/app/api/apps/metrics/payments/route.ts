import { NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/metrics/payments
 * 
 * Returns payment metrics from Stripe (global across all apps)
 */
export async function GET() {
  try {
    const metrics = await unifiedAppService.getPaymentMetrics();
    
    if (!metrics) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "Stripe integration not configured",
      });
    }
    
    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Failed to fetch payment metrics:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch payment metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
