/**
 * Notification Rules API
 * 
 * GET - Get all notification rules
 * POST - Create a new rule
 */

import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/lib/notifications/notification-service";
import { rulesEngine } from "@/lib/notifications/rules-engine";
import { getDbAsync } from "@/lib/db";
import { notificationRules } from "@/lib/schema-notifications";

/**
 * GET /api/notifications/rules
 * 
 * Get all notification rules
 */
export async function GET() {
  try {
    const rules = await notificationService.getRules();

    return NextResponse.json({
      rules,
      total: rules.length,
    });
  } catch (error) {
    console.error("Error fetching notification rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification rules" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/rules
 * 
 * Create a new notification rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.conditions || !body.channels) {
      return NextResponse.json(
        { error: "Missing required fields: name, conditions, channels" },
        { status: 400 }
      );
    }

    // Validate conditions structure
    if (typeof body.conditions !== "object") {
      return NextResponse.json(
        { error: "conditions must be an object" },
        { status: 400 }
      );
    }

    // Validate channels structure
    if (!Array.isArray(body.channels) || body.channels.length === 0) {
      return NextResponse.json(
        { error: "channels must be a non-empty array" },
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

    const now = new Date().toISOString();
    const id = `rule_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

    const record = {
      id,
      name: body.name,
      description: body.description || null,
      enabled: body.enabled !== false ? 1 : 0,
      priority: body.priority || 0,
      conditions: JSON.stringify(body.conditions),
      channels: JSON.stringify(body.channels),
      dedupe: body.dedupe ? JSON.stringify(body.dedupe) : null,
      schedule: body.schedule ? JSON.stringify(body.schedule) : null,
      createdAt: now,
      updatedAt: now,
      createdBy: body.createdBy || null,
    };

    await db.insert(notificationRules).values(record);

    // Reload rules in the engine
    await rulesEngine.loadRules();

    return NextResponse.json({
      id,
      name: body.name,
      description: body.description,
      enabled: body.enabled !== false,
      priority: body.priority || 0,
      conditions: body.conditions,
      channels: body.channels,
      dedupe: body.dedupe,
      schedule: body.schedule,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      createdBy: body.createdBy,
    });
  } catch (error) {
    console.error("Error creating notification rule:", error);
    return NextResponse.json(
      { error: "Failed to create notification rule" },
      { status: 500 }
    );
  }
}
