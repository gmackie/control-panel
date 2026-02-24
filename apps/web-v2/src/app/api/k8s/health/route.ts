import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMultiClusterManager } from "@/lib/cluster/multi-cluster-manager";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const manager = getMultiClusterManager();
    const health = await manager.healthCheck();
    return NextResponse.json(health);
  } catch (err) {
    console.error("[K8s API] Health check failed:", err);
    return NextResponse.json(
      { error: "Failed to check cluster health" },
      { status: 500 }
    );
  }
}
