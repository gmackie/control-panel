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

  try {
    const manager = getMultiClusterManager();
    const nodes = await manager.getNodes(clusterId ?? undefined);
    return NextResponse.json(nodes);
  } catch (err) {
    console.error("[K8s API] Nodes fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch nodes" },
      { status: 500 }
    );
  }
}
