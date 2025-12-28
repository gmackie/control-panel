import { NextResponse } from "next/server";
import { neonService } from "@/lib/neon/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    switch (resource) {
      case "projects": {
        const projects = await neonService.getProjects();
        return NextResponse.json({ data: projects });
      }
      case "stats": {
        const stats = await neonService.getDashboardStats();
        return NextResponse.json({ data: stats });
      }
      case "health": {
        const healthy = await neonService.healthCheck();
        return NextResponse.json({ data: { healthy } });
      }
      default:
        return NextResponse.json(
          { error: "Invalid resource type. Valid types: projects, stats, health" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to fetch Neon ${resource}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${resource}`, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
