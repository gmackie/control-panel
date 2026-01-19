import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import { vercelProjects } from "@repo/db";

/**
 * GET /api/vercel/projects
 * List all Vercel projects from the database
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
        { projects: [], error: "Database not available" },
        { status: 200 }
      );
    }

    const projects = await db.select().from(vercelProjects);

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.vercelProjectId,
        name: p.name,
        framework: p.framework,
        productionUrl: p.productionUrl,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch Vercel projects:", error);
    return NextResponse.json(
      { projects: [], error: "Failed to fetch projects" },
      { status: 200 }
    );
  }
}
