/**
 * Notifications API
 * 
 * GET - Query notifications with filters
 * POST - Create a new notification
 * PATCH - Bulk update notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/lib/notifications/notification-service";
import { rulesEngine } from "@/lib/notifications/rules-engine";
import {
  NotificationFilter,
  NotificationCategory,
  NotificationSeverity,
  NotificationStatus,
} from "@/lib/notifications/types";

/**
 * GET /api/notifications
 * 
 * Query notifications with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filter parameters
    const filter: NotificationFilter = {};

    const sources = searchParams.get("sources");
    if (sources) {
      filter.sources = sources.split(",");
    }

    const categories = searchParams.get("categories");
    if (categories) {
      filter.categories = categories.split(",") as NotificationCategory[];
    }

    const severities = searchParams.get("severities");
    if (severities) {
      filter.severities = severities.split(",") as NotificationSeverity[];
    }

    const statuses = searchParams.get("statuses");
    if (statuses) {
      filter.statuses = statuses.split(",") as NotificationStatus[];
    }

    const appIds = searchParams.get("appIds");
    if (appIds) {
      filter.appIds = appIds.split(",");
    }

    const userId = searchParams.get("userId");
    if (userId) {
      filter.userId = userId;
    }

    const startDate = searchParams.get("startDate");
    if (startDate) {
      filter.startDate = new Date(startDate);
    }

    const endDate = searchParams.get("endDate");
    if (endDate) {
      filter.endDate = new Date(endDate);
    }

    const search = searchParams.get("search");
    if (search) {
      filter.search = search;
    }

    const limit = searchParams.get("limit");
    if (limit) {
      filter.limit = parseInt(limit, 10);
    }

    const offset = searchParams.get("offset");
    if (offset) {
      filter.offset = parseInt(offset, 10);
    }

    const result = await notificationService.query(filter);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error querying notifications:", error);
    return NextResponse.json(
      { error: "Failed to query notifications" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * 
 * Create a new notification (goes through rules engine)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.source || !body.category || !body.severity || !body.title || !body.message) {
      return NextResponse.json(
        { error: "Missing required fields: source, category, severity, title, message" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: NotificationCategory[] = [
      "error", "payment", "security", "infrastructure", "deployment", "integration", "auth"
    ];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities: NotificationSeverity[] = ["info", "warning", "error", "critical"];
    if (!validSeverities.includes(body.severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(", ")}` },
        { status: 400 }
      );
    }

    // Process through rules engine
    const result = await rulesEngine.process({
      source: body.source,
      sourceEventId: body.sourceEventId,
      activityEventId: body.activityEventId,
      category: body.category,
      severity: body.severity,
      title: body.title,
      message: body.message,
      appId: body.appId,
      appName: body.appName,
      environment: body.environment,
      actions: body.actions,
      links: body.links,
      groupKey: body.groupKey,
      userId: body.userId,
      metadata: body.metadata,
    });

    if (result.deduplicated) {
      return NextResponse.json({
        deduplicated: true,
        message: "Notification was deduplicated with an existing notification",
      });
    }

    return NextResponse.json({
      notification: result.notification,
      deliveryResults: result.deliveryResults,
      matchedRules: result.matchedRules,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * 
 * Bulk update notifications
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { action, ids, userId } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Missing required field: action" },
        { status: 400 }
      );
    }

    let count = 0;

    switch (action) {
      case "mark-all-read":
        count = await notificationService.markAllAsRead(userId);
        break;

      case "acknowledge":
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json(
            { error: "Missing required field: ids (array)" },
            { status: 400 }
          );
        }
        count = await notificationService.bulkUpdateStatus(ids, "acknowledged", userId);
        break;

      case "resolve":
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json(
            { error: "Missing required field: ids (array)" },
            { status: 400 }
          );
        }
        count = await notificationService.bulkUpdateStatus(ids, "resolved", userId);
        break;

      default:
        return NextResponse.json(
          { error: `Invalid action. Must be one of: mark-all-read, acknowledge, resolve` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      count,
    });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
