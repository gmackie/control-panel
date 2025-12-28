import { NextResponse } from "next/server";
import { HarborService } from "@/lib/harbor/service";

const harborService = new HarborService();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    switch (resource) {
      case "projects": {
        const projects = await harborService.listProjects();
        return NextResponse.json({ data: projects });
      }
      case "repositories": {
        const repos = await harborService.listAllRepositories();
        return NextResponse.json({ data: repos });
      }
      case "stats": {
        const stats = await harborService.getStats();
        return NextResponse.json({ data: stats });
      }
      case "health": {
        const healthy = await harborService.healthCheck();
        return NextResponse.json({ data: { healthy } });
      }
      default:
        return NextResponse.json(
          { error: "Invalid resource type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to fetch Harbor ${resource}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${resource}`, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
