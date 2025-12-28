import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { HarborClient } from "@/lib/harbor/client";

function getHarborClient(): HarborClient | null {
  const baseUrl = process.env.HARBOR_URL;
  const username = process.env.HARBOR_USERNAME;
  const password = process.env.HARBOR_PASSWORD;
  
  if (!baseUrl || !username || !password) {
    return null;
  }
  
  return new HarborClient({ baseUrl, username, password });
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appId = decodeURIComponent(params.id);
    const appName = appId.includes("/") ? (appId.split("/")[1] ?? appId) : appId;
    const { searchParams } = new URL(request.url);
    const project = searchParams.get("project") || process.env.HARBOR_PROJECT || "library";
    
    const harborClient = getHarborClient();
    
    if (!harborClient) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        appName,
        message: "Harbor not configured",
      });
    }
    
    const artifacts = await harborClient.listArtifacts(project, appName, {
      withTag: true,
      withScanOverview: true,
      pageSize: 20,
    });
    
    const images = artifacts.map((artifact) => ({
      id: artifact.id,
      digest: artifact.digest,
      size: artifact.size,
      tags: artifact.tags?.map((t) => ({
        name: t.name,
        pushTime: t.push_time,
        immutable: t.immutable,
        signed: t.signed,
      })) || [],
      type: artifact.type,
      pushTime: artifact.push_time,
      pullTime: artifact.pull_time,
      scanStatus: artifact.scan_overview ? 
        Object.values(artifact.scan_overview)[0]?.scan_status : null,
      vulnerabilities: artifact.scan_overview ? 
        Object.values(artifact.scan_overview)[0]?.summary : null,
    }));
    
    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
      appName,
      project,
    });
  } catch (error) {
    console.error("Failed to fetch container images:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch container images",
        message: error instanceof Error ? error.message : "Unknown error",
        data: [],
      },
      { status: 500 }
    );
  }
}
