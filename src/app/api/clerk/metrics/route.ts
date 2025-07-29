import { NextRequest, NextResponse } from "next/server";
import { getClerkMetrics } from "@/lib/monitoring/clerk-monitor";

export async function GET(request: NextRequest) {
  try {
    const metrics = await getClerkMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to fetch Clerk metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch Clerk metrics" },
      { status: 500 }
    );
  }
}