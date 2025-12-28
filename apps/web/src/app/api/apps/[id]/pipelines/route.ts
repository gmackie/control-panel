import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GiteaService } from "@/lib/gitea/gitea-service";

const giteaService = new GiteaService();

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || undefined;
    
    const [owner, repo] = appId.includes("/") 
      ? appId.split("/") 
      : [process.env.GITEA_ORG || "gmackie", appId];
    
    const workflowRuns = await giteaService.getWorkflowRuns({
      owner,
      repo,
      status,
      limit,
    });
    
    const pipelines = workflowRuns.map((run) => ({
      id: run.id.toString(),
      name: run.name,
      status: run.status,
      conclusion: run.conclusion || null,
      branch: run.head_branch,
      sha: run.head_sha,
      event: run.event,
      runNumber: run.run_number,
      actor: run.actor?.login || "unknown",
      actorAvatar: run.actor?.avatar_url || "",
      startedAt: run.created_at,
      updatedAt: run.updated_at,
      commitMessage: run.head_commit?.message || "",
    }));
    
    return NextResponse.json({
      success: true,
      data: pipelines,
      count: pipelines.length,
      appId,
      limit,
    });
  } catch (error) {
    console.error("Failed to fetch pipelines:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch pipelines",
        message: error instanceof Error ? error.message : "Unknown error",
        data: [],
      },
      { status: 500 }
    );
  }
}
