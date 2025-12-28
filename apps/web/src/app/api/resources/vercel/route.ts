import { NextResponse } from "next/server";
import { vercelService } from "@/lib/vercel/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    switch (resource) {
      case "projects": {
        const projects = await vercelService.getProjects();
        return NextResponse.json({ data: projects });
      }
      case "deployments": {
        const projectId = searchParams.get("projectId");
        if (projectId) {
          const deployments = await vercelService.getDeploymentsByProject(projectId);
          return NextResponse.json({ data: deployments });
        }
        // Get recent deployments
        const deployments = await vercelService.getRecentDeployments(20);
        return NextResponse.json({ data: deployments });
      }
      case "domains": {
        const projectId = searchParams.get("projectId");
        if (!projectId) {
          return NextResponse.json({ error: "projectId required" }, { status: 400 });
        }
        const domains = await vercelService.getProjectDomains(projectId);
        return NextResponse.json({ data: domains });
      }
      case "stats": {
        const stats = await vercelService.getDashboardStats();
        return NextResponse.json({ data: stats });
      }
      case "health": {
        const healthy = await vercelService.healthCheck();
        return NextResponse.json({ data: { healthy } });
      }
      default:
        return NextResponse.json(
          { error: "Invalid resource type. Valid types: projects, deployments, domains, stats, health" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to fetch Vercel ${resource}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${resource}`, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
