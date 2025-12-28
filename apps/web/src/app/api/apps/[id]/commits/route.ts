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
    const limit = parseInt(searchParams.get("limit") || "50");
    const branch = searchParams.get("branch") || undefined;
    
    const [owner, repo] = appId.includes("/") 
      ? appId.split("/") 
      : [process.env.GITEA_ORG || "gmackie", appId];
    
    const commits = await giteaService.getCommits(owner, repo, { 
      sha: branch,
      limit 
    });
    
    const formattedCommits = commits.map((commit: any) => ({
      sha: commit.sha || commit.id,
      message: commit.commit?.message || commit.message || "",
      author: commit.commit?.author?.name || commit.author?.login || "Unknown",
      authorEmail: commit.commit?.author?.email || "",
      authorAvatar: commit.author?.avatar_url || "",
      date: commit.commit?.author?.date || commit.created_at || new Date().toISOString(),
      url: commit.html_url || "",
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedCommits,
      count: formattedCommits.length,
      appId,
      limit,
    });
  } catch (error) {
    console.error("Failed to fetch commits:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch commits",
        message: error instanceof Error ? error.message : "Unknown error",
        data: [],
      },
      { status: 500 }
    );
  }
}
