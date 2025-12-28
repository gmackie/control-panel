/**
 * Notification Stats API
 * 
 * GET - Get notification statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/lib/notifications/notification-service";

/**
 * GET /api/notifications/stats
 * 
 * Get notification statistics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || undefined;

    const stats = await notificationService.getStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification stats" },
      { status: 500 }
    );
  }
}
