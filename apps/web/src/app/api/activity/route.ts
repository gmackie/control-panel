/**
 * Activity Feed API
 * 
 * GET /api/activity - Query activity events
 * GET /api/activity?action=stats - Get activity statistics
 * GET /api/activity?action=recent - Get recent events
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { activityService } from "@/lib/activity/activity-service";
import { ActivitySource, ActivityCategory, ActivitySeverity } from "@/lib/activity/types";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "query";

    switch (action) {
      case "stats": {
        const stats = await activityService.getStats();
        return NextResponse.json(stats);
      }

      case "recent": {
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const events = await activityService.getRecent(limit);
        return NextResponse.json({ events });
      }

      case "by-app": {
        const appId = searchParams.get("appId");
        if (!appId) {
          return NextResponse.json({ error: "appId required" }, { status: 400 });
        }
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const events = await activityService.getByApp(appId, limit);
        return NextResponse.json({ events });
      }

      case "query":
      default: {
        // Parse filter parameters
        const sources = searchParams.get("sources")?.split(",").filter(Boolean) as ActivitySource[] | undefined;
        const categories = searchParams.get("categories")?.split(",").filter(Boolean) as ActivityCategory[] | undefined;
        const severities = searchParams.get("severities")?.split(",").filter(Boolean) as ActivitySeverity[] | undefined;
        const appIds = searchParams.get("appIds")?.split(",").filter(Boolean);
        const environments = searchParams.get("environments")?.split(",").filter(Boolean);
        const search = searchParams.get("search") || undefined;
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        // Parse dates
        const startDateStr = searchParams.get("startDate");
        const endDateStr = searchParams.get("endDate");
        const startDate = startDateStr ? new Date(startDateStr) : undefined;
        const endDate = endDateStr ? new Date(endDateStr) : undefined;

        const result = await activityService.query({
          sources,
          categories,
          severities,
          appIds,
          environments,
          startDate,
          endDate,
          search,
          limit,
          offset,
        });

        return NextResponse.json(result);
      }
    }
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
