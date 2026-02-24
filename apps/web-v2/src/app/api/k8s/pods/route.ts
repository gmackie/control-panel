import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMultiClusterManager } from "@/lib/cluster/multi-cluster-manager";
import type { ClusterId } from "@/types/k8s";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clusterId = req.nextUrl.searchParams.get("clusterId") as ClusterId | null;
  const namespace = req.nextUrl.searchParams.get("namespace");

  try {
    const manager = getMultiClusterManager();
    const pods = await manager.getPods(
      clusterId ?? undefined,
      namespace ?? undefined
    );
    return NextResponse.json(pods);
  } catch (err) {
    console.error("[K8s API] Pods fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch pods" },
      { status: 500 }
    );
  }
}
