import { NextResponse } from "next/server";
import { githubService } from "@/lib/github/github-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    switch (resource) {
      case "repositories": {
        const repos = await githubService.getRepositories();
        return NextResponse.json({ data: repos });
      }
      case "workflows": {
        const owner = searchParams.get("owner");
        const repo = searchParams.get("repo");
        if (owner && repo) {
          const runs = await githubService.getWorkflowRuns(owner, repo);
          return NextResponse.json({ data: runs });
        }
        // Get recent workflow runs across repos
        const repos = await githubService.getRepositories();
        const allRuns: any[] = [];
        for (const r of repos.slice(0, 5)) {
          try {
            const runs = await githubService.getWorkflowRuns(r.owner.login, r.name);
            allRuns.push(...runs.slice(0, 3));
          } catch {
            // Skip repos without workflows
          }
        }
        allRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return NextResponse.json({ data: allRuns.slice(0, 15) });
      }
      case "stats": {
        const stats = await githubService.getRepoStats();
        return NextResponse.json({ data: stats });
      }
      case "rate-limit": {
        const rateLimit = await githubService.getRateLimit();
        return NextResponse.json({ data: rateLimit });
      }
      case "health": {
        const healthy = await githubService.healthCheck();
        return NextResponse.json({ data: { healthy } });
      }
      default:
        return NextResponse.json(
          { error: "Invalid resource type. Valid types: repositories, workflows, stats, rate-limit, health" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to fetch GitHub ${resource}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${resource}`, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
