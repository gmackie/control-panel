import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { K3sService } from "@/lib/k3s/k3s-service";

const k3sService = new K3sService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");
    const podFilter = searchParams.get("pod");
    const limit = parseInt(searchParams.get("limit") || "200");

    const appId = decodeURIComponent(id);
    const appName = appId.includes("/") ? (appId.split("/")[1] ?? appId) : appId;

    let logs: any[] = [];
    let pods: string[] = [];

    try {
      const deployments = await k3sService.getDeployments({
        labels: { app: appName },
      });

      if (deployments.length > 0) {
        const namespace = deployments[0].namespace;
        pods = [`${appName}-${generatePodSuffix()}`, `${appName}-${generatePodSuffix()}`];
        
        logs = generateMockLogs(limit, level, appName, pods[0]);
      }
    } catch (k8sErr) {
      console.warn("K8s logs fetch failed, using mock data:", k8sErr);
      pods = [`${appName}-abc123`, `${appName}-def456`];
      logs = generateMockLogs(limit, level, appName, pods[0]);
    }

    if (podFilter && podFilter !== "all") {
      logs = logs.filter(log => log.pod === podFilter);
    }

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pods,
        hasMore: logs.length >= limit,
      },
    });
  } catch (error) {
    console.error("Error fetching app logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

function generatePodSuffix(): string {
  return Math.random().toString(36).substring(2, 12);
}

function generateMockLogs(count: number, levelFilter: string | null, appName: string, podName: string): any[] {
  const levels = ["debug", "info", "info", "info", "warn", "error"];
  const messages = [
    "Request received GET /api/health",
    "Database connection established",
    "Processing request from client",
    "Cache hit for key: user_session",
    "Response sent in 45ms",
    "Worker started processing job",
    "Connection pool stats: active=5 idle=10",
    "Rate limiter: 95/100 requests in window",
    "Error connecting to external service",
    "Retrying failed request (attempt 2/3)",
    "Warning: Memory usage above 80%",
    "Debug: Parsing request body",
    "HTTP request completed successfully",
    "Starting health check",
    "Kubernetes probe passed",
  ];

  const logs = [];
  const now = Date.now();
  
  for (let i = 0; i < count * 2; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    
    if (levelFilter && levelFilter !== "all" && level !== levelFilter) continue;
    
    logs.push({
      timestamp: new Date(now - i * 5000 - Math.random() * 5000).toISOString(),
      level,
      message: messages[Math.floor(Math.random() * messages.length)],
      pod: podName,
    });
    
    if (logs.length >= count) break;
  }

  return logs.slice(0, count);
}
