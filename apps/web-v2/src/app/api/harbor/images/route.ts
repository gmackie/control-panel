import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { harborService } from "@/lib/harbor/service";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = req.nextUrl.searchParams.get("project");
  const repository = req.nextUrl.searchParams.get("repository");

  if (!project || !repository) {
    return NextResponse.json(
      { error: "Missing required params: project, repository" },
      { status: 400 }
    );
  }

  try {
    const artifacts = await harborService.listArtifacts(project, repository);
    return NextResponse.json(artifacts);
  } catch (err) {
    console.error("[Harbor] Images fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch Harbor images" },
      { status: 500 }
    );
  }
}
