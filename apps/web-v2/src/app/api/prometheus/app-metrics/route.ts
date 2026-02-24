import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrometheusClient } from "@/lib/prometheus/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const namespace = req.nextUrl.searchParams.get("namespace");
  const app = req.nextUrl.searchParams.get("app");

  if (!namespace || !app) {
    return NextResponse.json(
      { error: "Missing required params: namespace, app" },
      { status: 400 }
    );
  }

  if (!process.env.PROMETHEUS_URL) {
    return NextResponse.json(
      { error: "PROMETHEUS_URL not configured", hint: "Run: kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090" },
      { status: 503 }
    );
  }

  try {
    const client = new PrometheusClient();
    const metrics = await client.getApplicationMetrics(namespace, app);
    return NextResponse.json(metrics);
  } catch (err) {
    console.error("[Prometheus] Metrics fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch Prometheus metrics" },
      { status: 500 }
    );
  }
}
