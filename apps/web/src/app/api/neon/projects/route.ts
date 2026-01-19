import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import { neonProjects } from "@repo/db";

/**
 * GET /api/neon/projects
 * List all Neon projects from the database
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

    const projects = await db.select().from(neonProjects);

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.neonProjectId,
        name: p.name,
        regionId: p.regionId,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch Neon projects:", error);
    return NextResponse.json(
      { projects: [], error: "Failed to fetch projects" },
      { status: 200 }
    );
  }
}
