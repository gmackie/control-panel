import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import { githubRepositories } from "@repo/db";

/**
 * GET /api/github/repos
 * List all GitHub repositories from the database
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json(
        { repos: [], error: "Database not available" },
        { status: 200 }
      );
    }

    const repos = await db.select().from(githubRepositories);

    return NextResponse.json({
      repos: repos.map((r) => ({
        id: r.githubRepoId,
        name: r.name,
        full_name: r.fullName,
        html_url: r.htmlUrl,
        clone_url: r.cloneUrl,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch GitHub repositories:", error);
    return NextResponse.json(
      { repos: [], error: "Failed to fetch repositories" },
      { status: 200 }
    );
  }
}
