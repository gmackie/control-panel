import { NextRequest, NextResponse } from "next/server";
import { Monitoring } from "@/types";

// Mock data - replace with actual database queries
const mockMonitoring: Record<string, Monitoring> = {
  "1": {
    serviceId: "1",
    prometheus: {
      enabled: true,
      url: "http://prometheus.gmac.io",
      metrics: [
        "http_requests_total",
        "http_request_duration_seconds",
        "http_requests_in_flight",
        "process_cpu_seconds_total",
        "process_resident_memory_bytes",
      ],
      alerts: [
        {
          id: "1",
          name: "High CPU Usage",
          severity: "warning",
          status: "firing",
          startsAt: new Date().toISOString(),
          summary: "CPU usage is above 80%",
          description: "The service is experiencing high CPU usage",
        },
        {
          id: "2",
          name: "High Error Rate",
          severity: "critical",
          status: "resolved",
          startsAt: new Date(Date.now() - 3600000).toISOString(),
          endsAt: new Date().toISOString(),
          summary: "Error rate is above 5%",
          description: "The service is experiencing a high error rate",
        },
      ],
    },
    grafana: {
      enabled: true,
      url: "http://grafana.gmac.io",
      dashboards: [
        {
          id: "1",
          title: "Control Panel Overview",
          uid: "control-panel-overview",
          url: "http://grafana.gmac.io/d/control-panel-overview",
          version: 1,
          updatedAt: new Date().toISOString(),
          panels: [
            {
              id: "1",
              title: "Request Rate",
              type: "graph",
              targets: [
                {
                  expr: "rate(http_requests_total[5m])",
                  legendFormat: "{{method}} {{status}}",
                  refId: "A",
                },
              ],
              options: {
                legend: { showLegend: true },
                tooltip: { mode: "single" },
              },
            },
            {
              id: "2",
              title: "Response Time",
              type: "graph",
              targets: [
                {
                  expr: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                  legendFormat: "p95",
                  refId: "A",
                },
              ],
              options: {
                legend: { showLegend: true },
                tooltip: { mode: "single" },
              },
            },
          ],
        },
        {
          id: "2",
          title: "System Resources",
          uid: "system-resources",
          url: "http://grafana.gmac.io/d/system-resources",
          version: 1,
          updatedAt: new Date().toISOString(),
          panels: [
            {
              id: "3",
              title: "CPU Usage",
              type: "stat",
              targets: [
                {
                  expr: "rate(process_cpu_seconds_total[5m]) * 100",
                  legendFormat: "CPU %",
                  refId: "A",
                },
              ],
              options: {
                colorMode: "value",
                graphMode: "area",
                justifyMode: "auto",
                orientation: "auto",
                reduceOptions: {
                  calcs: ["lastNotNull"],
                  fields: "",
                  values: false,
                },
                textMode: "auto",
              },
            },
          ],
        },
      ],
    },
    alertmanager: {
      enabled: true,
      url: "http://alertmanager.gmac.io",
      receivers: [
        {
          id: "1",
          name: "Slack Alerts",
          type: "slack",
          config: {
            webhookUrl: "https://hooks.slack.com/services/...",
            channel: "#alerts",
          },
          status: "active",
        },
        {
          id: "2",
          name: "Email Alerts",
          type: "email",
          config: {
            to: "admin@gmac.io",
            from: "alerts@gmac.io",
          },
          status: "active",
        },
      ],
    },
    logs: {
      enabled: true,
      provider: "loki",
      retention: "30d",
      filters: [
        {
          id: "1",
          name: "Error Logs",
          query: '{service="control-panel"} |= "error"',
          level: "error",
          timeRange: "1h",
        },
        {
          id: "2",
          name: "Slow Requests",
          query: '{service="control-panel"} | json | duration > 1000',
          level: "warn",
          timeRange: "1h",
        },
      ],
    },
  },
  "2": {
    serviceId: "2",
    prometheus: {
      enabled: true,
      url: "http://prometheus.gmac.io",
      metrics: [
        "http_requests_total",
        "http_request_duration_seconds",
        "grpc_server_started_total",
        "grpc_server_msg_received_total",
      ],
      alerts: [],
    },
    grafana: {
      enabled: true,
      url: "http://grafana.gmac.io",
      dashboards: [
        {
          id: "3",
          title: "API Gateway Overview",
          uid: "api-gateway-overview",
          url: "http://grafana.gmac.io/d/api-gateway-overview",
          version: 1,
          updatedAt: new Date().toISOString(),
          panels: [],
        },
      ],
    },
    alertmanager: {
      enabled: true,
      url: "http://alertmanager.gmac.io",
      receivers: [
        {
          id: "3",
          name: "API Alerts",
          type: "slack",
          config: {
            webhookUrl: "https://hooks.slack.com/services/...",
            channel: "#api-alerts",
          },
          status: "active",
        },
      ],
    },
    logs: {
      enabled: true,
      provider: "loki",
      retention: "30d",
      filters: [
        {
          id: "3",
          name: "API Errors",
          query: '{service="api-gateway"} |= "error"',
          level: "error",
          timeRange: "1h",
        },
      ],
    },
  },
  "3": {
    serviceId: "3",
    prometheus: {
      enabled: true,
      url: "http://prometheus.gmac.io",
      metrics: [
        "worker_jobs_processed_total",
        "worker_jobs_failed_total",
        "worker_queue_size",
        "worker_processing_duration_seconds",
      ],
      alerts: [
        {
          id: "3",
          name: "High Job Failure Rate",
          severity: "warning",
          status: "firing",
          startsAt: new Date().toISOString(),
          summary: "Job failure rate is above 10%",
          description: "The worker is experiencing a high job failure rate",
        },
      ],
    },
    grafana: {
      enabled: true,
      url: "http://grafana.gmac.io",
      dashboards: [
        {
          id: "4",
          title: "Worker Overview",
          uid: "worker-overview",
          url: "http://grafana.gmac.io/d/worker-overview",
          version: 1,
          updatedAt: new Date().toISOString(),
          panels: [],
        },
      ],
    },
    alertmanager: {
      enabled: true,
      url: "http://alertmanager.gmac.io",
      receivers: [
        {
          id: "4",
          name: "Worker Alerts",
          type: "slack",
          config: {
            webhookUrl: "https://hooks.slack.com/services/...",
            channel: "#worker-alerts",
          },
          status: "active",
        },
      ],
    },
    logs: {
      enabled: true,
      provider: "loki",
      retention: "30d",
      filters: [
        {
          id: "4",
          name: "Worker Errors",
          query: '{service="background-worker"} |= "error"',
          level: "error",
          timeRange: "1h",
        },
      ],
    },
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const monitoring = mockMonitoring[params.id];

    if (!monitoring) {
      return NextResponse.json(
        { error: "Monitoring configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(monitoring);
  } catch (error) {
    console.error("Failed to fetch monitoring:", error);
    return NextResponse.json(
      { error: "Failed to fetch monitoring" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // In production, update monitoring configuration
    const updatedMonitoring = {
      ...mockMonitoring[params.id],
      ...body,
    };

    return NextResponse.json(updatedMonitoring);
  } catch (error) {
    console.error("Failed to update monitoring:", error);
    return NextResponse.json(
      { error: "Failed to update monitoring" },
      { status: 500 }
    );
  }
}
