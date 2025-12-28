import { NextResponse } from "next/server";
import { GiteaService } from "@/lib/gitea/gitea-service";

const giteaService = new GiteaService();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    switch (resource) {
      case "repositories": {
        const repos = await giteaService.getRepositories();
        return NextResponse.json({ data: repos });
      }
      case "user": {
        const user = await giteaService.getCurrentUser();
        return NextResponse.json({ data: user });
      }
      case "organizations": {
        const orgs = await giteaService.getOrganizations();
        return NextResponse.json({ data: orgs });
      }
      case "workflows": {
        const workflows = await giteaService.getWorkflowRuns({});
        return NextResponse.json({ data: workflows });
      }
      case "health": {
        const healthy = await giteaService.healthCheck();
        return NextResponse.json({ data: { healthy } });
      }
      default:
        return NextResponse.json(
          { error: "Invalid resource type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to fetch Gitea ${resource}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${resource}`, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
