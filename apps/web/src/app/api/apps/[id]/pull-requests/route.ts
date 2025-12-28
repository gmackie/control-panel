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
    const state = (searchParams.get("state") as "open" | "closed" | "all") || "open";
    
    const [owner, repo] = appId.includes("/") 
      ? appId.split("/") 
      : [process.env.GITEA_ORG || "gmackie", appId];
    
    const prs = await giteaService.getPullRequests(owner, repo, state);
    
    const pullRequests = prs.map((pr: any) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user?.login || pr.user?.username || "unknown",
      authorAvatar: pr.user?.avatar_url || "",
      body: pr.body || "",
      labels: pr.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
      draft: pr.draft || false,
      mergeable: pr.mergeable,
      merged: pr.merged,
      mergedAt: pr.merged_at,
      mergedBy: pr.merged_by?.login || null,
      baseBranch: pr.base?.ref || "main",
      headBranch: pr.head?.ref || "",
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url || "",
    }));
    
    return NextResponse.json({
      success: true,
      data: pullRequests,
      count: pullRequests.length,
      appId,
      state,
    });
  } catch (error) {
    console.error("Failed to fetch pull requests:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch pull requests",
        message: error instanceof Error ? error.message : "Unknown error",
        data: [],
      },
      { status: 500 }
    );
  }
}
