/**
 * Single Notification API
 * 
 * GET - Get notification by ID
 * PATCH - Update notification status
 */

import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/lib/notifications/notification-service";
import { NotificationStatus } from "@/lib/notifications/types";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/notifications/[id]
 * 
 * Get a single notification by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const notification = await notificationService.getById(id);

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error fetching notification:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/[id]
 * 
 * Update notification status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status, userId, snoozedUntil } = body;

    // Handle snooze separately
    if (snoozedUntil) {
      const until = new Date(snoozedUntil);
      if (isNaN(until.getTime())) {
        return NextResponse.json(
          { error: "Invalid snoozedUntil date" },
          { status: 400 }
        );
      }

      const notification = await notificationService.snooze(id, until);
      if (!notification) {
        return NextResponse.json(
          { error: "Notification not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(notification);
    }

    // Handle status update
    if (!status) {
      return NextResponse.json(
        { error: "Missing required field: status or snoozedUntil" },
        { status: 400 }
      );
    }

    const validStatuses: NotificationStatus[] = [
      "new", "seen", "acknowledged", "resolved", "snoozed"
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const notification = await notificationService.updateStatus(id, status, userId);

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
