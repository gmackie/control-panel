import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const appId = decodeURIComponent(id);
    const appName = appId.includes("/") ? (appId.split("/")[1] ?? appId) : appId;
    const slug = appName.toLowerCase().replace(/\s+/g, "-");

    const now = Date.now();
    const alerts = generateMockAlerts(appName, slug);
    const rules = generateMockRules(appName);

    const firingAlerts = alerts.filter(a => a.status === "firing");
    const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged");
    const resolved24h = alerts.filter(a => {
      if (a.status !== "resolved" || !a.resolvedAt) return false;
      return (now - new Date(a.resolvedAt).getTime()) < 24 * 60 * 60 * 1000;
    });

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        rules,
        summary: {
          firing: firingAlerts.length,
          acknowledged: acknowledgedAlerts.length,
          resolved24h: resolved24h.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching app alerts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

function generateMockAlerts(appName: string, slug: string): any[] {
  const now = Date.now();
  
  return [
    {
      id: `alert-${slug}-001`,
      ruleName: "High Memory Usage",
      message: `Memory usage above 85% on ${appName} for 5 minutes`,
      severity: "medium",
      status: "firing",
      startedAt: new Date(now - 15 * 60 * 1000).toISOString(),
      source: "prometheus",
      tags: { app: slug, metric: "memory" },
    },
    {
      id: `alert-${slug}-002`,
      ruleName: "Slow Response Time",
      message: `Average response time > 500ms on ${appName}`,
      severity: "low",
      status: "acknowledged",
      startedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      acknowledgedAt: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
      acknowledgedBy: "admin@gmac.io",
      source: "application-metrics",
      tags: { app: slug, metric: "latency" },
    },
    {
      id: `alert-${slug}-003`,
      ruleName: "Pod Restart",
      message: `Pod ${slug}-abc123 restarted`,
      severity: "info",
      status: "resolved",
      startedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(now - 5.5 * 60 * 60 * 1000).toISOString(),
      source: "kubernetes",
      tags: { app: slug, pod: `${slug}-abc123` },
    },
  ];
}

function generateMockRules(appName: string): any[] {
  return [
    {
      id: "rule-high-cpu",
      name: "High CPU Usage",
      description: `Alert when ${appName} CPU usage exceeds 80% for 5 minutes`,
      severity: "high",
      enabled: true,
      triggerCount: 3,
      lastTriggered: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "rule-high-memory",
      name: "High Memory Usage",
      description: `Alert when ${appName} memory usage exceeds 85%`,
      severity: "medium",
      enabled: true,
      triggerCount: 5,
      lastTriggered: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: "rule-error-rate",
      name: "High Error Rate",
      description: `Alert when ${appName} error rate exceeds 5%`,
      severity: "critical",
      enabled: true,
      triggerCount: 1,
      lastTriggered: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "rule-slow-response",
      name: "Slow Response Time",
      description: `Alert when ${appName} p95 latency exceeds 500ms`,
      severity: "low",
      enabled: true,
      triggerCount: 8,
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
