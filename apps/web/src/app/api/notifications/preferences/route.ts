/**
 * Notification Preferences API
 * 
 * GET - Get user preferences
 * PUT - Update user preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/lib/notifications/notification-service";
import { getDbAsync } from "@/lib/db";
import { notificationPreferences } from "@repo/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/notifications/preferences
 * 
 * Get notification preferences for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required parameter: userId" },
        { status: 400 }
      );
    }

    const preferences = await notificationService.getOrCreatePreferences(userId);

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * 
 * Update notification preferences for a user
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    // Ensure preferences exist
    await notificationService.getOrCreatePreferences(userId);

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof body.emailEnabled === "boolean") {
      updates.emailEnabled = body.emailEnabled ? 1 : 0;
    }
    if (typeof body.slackEnabled === "boolean") {
      updates.slackEnabled = body.slackEnabled ? 1 : 0;
    }
    if (typeof body.pushEnabled === "boolean") {
      updates.pushEnabled = body.pushEnabled ? 1 : 0;
    }
    if (typeof body.inAppEnabled === "boolean") {
      updates.inAppEnabled = body.inAppEnabled ? 1 : 0;
    }
    if (body.categoryPreferences !== undefined) {
      updates.categoryPreferences = JSON.stringify(body.categoryPreferences);
    }
    if (body.quietHours !== undefined) {
      updates.quietHours = body.quietHours ? JSON.stringify(body.quietHours) : null;
    }
    if (body.emailDigest !== undefined) {
      updates.emailDigest = body.emailDigest ? JSON.stringify(body.emailDigest) : null;
    }

    await db
      .update(notificationPreferences)
      .set(updates)
      .where(eq(notificationPreferences.userId, userId));

    // Return updated preferences
    const preferences = await notificationService.getPreferences(userId);

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
