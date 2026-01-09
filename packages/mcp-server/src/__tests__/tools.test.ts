import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpContext } from "../context.js";
import type { ControlPanelClient, Application, ApplicationHealth, ClusterSummary, Alert } from "../api-client.js";

function createMockClient(): ControlPanelClient {
  return {
    applications: {
      list: vi.fn(),
      byId: vi.fn(),
      bySlug: vi.fn(),
      listWithHealth: vi.fn(),
      create: vi.fn(),
    },
    clusters: {
      list: vi.fn(),
      byId: vi.fn(),
      nodes: vi.fn(),
      health: vi.fn(),
      costs: vi.fn(),
      scale: vi.fn(),
    },
    infrastructure: {
      repositories: vi.fn(),
      repository: vi.fn(),
      images: vi.fn(),
      image: vi.fn(),
      servers: vi.fn(),
      server: vi.fn(),
      health: vi.fn(),
      serverPower: vi.fn(),
      deleteImageTag: vi.fn(),
    },
    deployments: {
      list: vi.fn(),
      byId: vi.fn(),
      stats: vi.fn(),
      trigger: vi.fn(),
      rollback: vi.fn(),
      cancel: vi.fn(),
    },
    monitoring: {
      alerts: vi.fn(),
      alertById: vi.fn(),
      alertStats: vi.fn(),
      acknowledgeAlert: vi.fn(),
      metrics: vi.fn(),
      services: vi.fn(),
      serviceByName: vi.fn(),
      healthSummary: vi.fn(),
    },
    healthCheck: vi.fn(),
  } as unknown as ControlPanelClient;
}

function createMockContext(client: ControlPanelClient): McpContext {
  return {
    config: {
      controlPanelUrl: "https://control.example.com",
      apiKey: "cp_test_key",
    },
    api: client,
  };
}

describe("Applications Tools Integration", () => {
  let mockClient: ControlPanelClient;
  let ctx: McpContext;

  const mockApplications: Application[] = [
    {
      id: "app-1",
      name: "Frontend App",
      slug: "frontend-app",
      description: "Main frontend application",
      repositoryUrl: "https://git.example.com/frontend",
      status: "active",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-06-01"),
    },
    {
      id: "app-2",
      name: "Backend API",
      slug: "backend-api",
      description: "REST API service",
      repositoryUrl: "https://git.example.com/backend",
      status: "active",
      createdAt: new Date("2024-02-01"),
      updatedAt: new Date("2024-06-15"),
    },
  ];

  const mockApplicationsWithHealth: ApplicationHealth[] = [
    {
      id: "app-1",
      name: "Frontend App",
      slug: "frontend-app",
      status: "healthy",
      alertCounts: { critical: 0, warning: 1 },
      latestAlert: { message: "High memory usage", severity: "warning", timestamp: new Date() },
      lastActivity: new Date(),
    },
    {
      id: "app-2",
      name: "Backend API",
      slug: "backend-api",
      status: "critical",
      alertCounts: { critical: 2, warning: 0 },
      latestAlert: { message: "Service unreachable", severity: "critical", timestamp: new Date() },
      lastActivity: new Date(),
    },
  ];

  beforeEach(() => {
    mockClient = createMockClient();
    ctx = createMockContext(mockClient);
  });

  describe("list_applications", () => {
    it("returns all applications with metadata", async () => {
      vi.mocked(mockClient.applications.list).mockResolvedValue(mockApplications);

      const apps = await ctx.api.applications.list();

      expect(apps).toHaveLength(2);
      expect(apps[0].name).toBe("Frontend App");
      expect(apps[1].slug).toBe("backend-api");
    });

    it("returns empty array when no applications exist", async () => {
      vi.mocked(mockClient.applications.list).mockResolvedValue([]);

      const apps = await ctx.api.applications.list();

      expect(apps).toEqual([]);
    });
  });

  describe("list_applications_with_health", () => {
    it("returns applications with health status", async () => {
      vi.mocked(mockClient.applications.listWithHealth).mockResolvedValue(mockApplicationsWithHealth);

      const apps = await ctx.api.applications.listWithHealth();

      expect(apps).toHaveLength(2);
      expect(apps[0].status).toBe("healthy");
      expect(apps[1].status).toBe("critical");
      expect(apps[1].alertCounts.critical).toBe(2);
    });
  });

  describe("get_application", () => {
    it("returns application by ID", async () => {
      vi.mocked(mockClient.applications.byId).mockResolvedValue(mockApplications[0]);

      const app = await ctx.api.applications.byId("app-1");

      expect(app.id).toBe("app-1");
      expect(app.name).toBe("Frontend App");
      expect(mockClient.applications.byId).toHaveBeenCalledWith("app-1");
    });

    it("handles not found application", async () => {
      vi.mocked(mockClient.applications.byId).mockResolvedValue(null as unknown as Application);

      const app = await ctx.api.applications.byId("nonexistent");

      expect(app).toBeNull();
    });
  });

  describe("create_application", () => {
    it("creates new application", async () => {
      const newApp: Application = {
        id: "app-3",
        name: "New Service",
        slug: "new-service",
        description: "A new service",
        repositoryUrl: null,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(mockClient.applications.create).mockResolvedValue(newApp);

      const result = await ctx.api.applications.create({
        name: "New Service",
        slug: "new-service",
        description: "A new service",
      });

      expect(result.id).toBe("app-3");
      expect(mockClient.applications.create).toHaveBeenCalledWith({
        name: "New Service",
        slug: "new-service",
        description: "A new service",
      });
    });
  });
});

describe("Clusters Tools Integration", () => {
  let mockClient: ControlPanelClient;
  let ctx: McpContext;

  const mockClusters: ClusterSummary[] = [
    {
      id: "cluster-1",
      name: "production",
      provider: "hetzner",
      region: "eu-central",
      version: "1.28.5",
      status: "healthy",
      nodeCount: 5,
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "cluster-2",
      name: "staging",
      provider: "hetzner",
      region: "eu-west",
      version: "1.28.5",
      status: "degraded",
      nodeCount: 3,
      createdAt: "2024-02-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    mockClient = createMockClient();
    ctx = createMockContext(mockClient);
  });

  describe("list_clusters", () => {
    it("returns all clusters", async () => {
      vi.mocked(mockClient.clusters.list).mockResolvedValue(mockClusters);

      const clusters = await ctx.api.clusters.list();

      expect(clusters).toHaveLength(2);
      expect(clusters[0].name).toBe("production");
      expect(clusters[0].status).toBe("healthy");
    });
  });

  describe("get_cluster_health", () => {
    it("returns aggregated health metrics", async () => {
      vi.mocked(mockClient.clusters.health).mockResolvedValue({
        totalClusters: 2,
        healthyClusters: 1,
        totalNodes: 8,
        readyNodes: 7,
        avgCpuUsage: 45,
        avgMemoryUsage: 62,
      });

      const health = await ctx.api.clusters.health();

      expect(health.totalClusters).toBe(2);
      expect(health.healthyClusters).toBe(1);
      expect(health.avgCpuUsage).toBe(45);
    });
  });

  describe("scale_cluster", () => {
    it("scales cluster to specified node count", async () => {
      vi.mocked(mockClient.clusters.scale).mockResolvedValue({
        success: true,
        message: "Scaling initiated",
        clusterId: "cluster-1",
        targetNodeCount: 10,
      });

      const result = await ctx.api.clusters.scale({ clusterId: "cluster-1", nodeCount: 10 });

      expect(result.success).toBe(true);
      expect(result.targetNodeCount).toBe(10);
      expect(mockClient.clusters.scale).toHaveBeenCalledWith({
        clusterId: "cluster-1",
        nodeCount: 10,
      });
    });
  });
});

describe("Monitoring Tools Integration", () => {
  let mockClient: ControlPanelClient;
  let ctx: McpContext;

  const mockAlerts: Alert[] = [
    {
      id: "alert-1",
      name: "HighCPUUsage",
      severity: "warning",
      status: "firing",
      source: "prometheus",
      message: "CPU usage above 80% for 5 minutes",
      labels: { cluster: "production", node: "node-1" },
      annotations: { dashboard: "https://grafana.example.com" },
      startsAt: "2024-06-20T10:00:00Z",
    },
    {
      id: "alert-2",
      name: "ServiceDown",
      severity: "critical",
      status: "firing",
      source: "prometheus",
      message: "Backend service unreachable",
      labels: { service: "backend-api" },
      annotations: {},
      startsAt: "2024-06-20T11:00:00Z",
    },
  ];

  beforeEach(() => {
    mockClient = createMockClient();
    ctx = createMockContext(mockClient);
  });

  describe("list_alerts", () => {
    it("returns all alerts", async () => {
      vi.mocked(mockClient.monitoring.alerts).mockResolvedValue(mockAlerts);

      const alerts = await ctx.api.monitoring.alerts();

      expect(alerts).toHaveLength(2);
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[1].severity).toBe("critical");
    });

    it("filters alerts by status", async () => {
      const firingAlerts = mockAlerts.filter((a) => a.status === "firing");
      vi.mocked(mockClient.monitoring.alerts).mockResolvedValue(firingAlerts);

      const alerts = await ctx.api.monitoring.alerts({ status: "firing" });

      expect(alerts).toHaveLength(2);
      expect(alerts.every((a) => a.status === "firing")).toBe(true);
    });
  });

  describe("acknowledge_alert", () => {
    it("acknowledges an alert with comment", async () => {
      vi.mocked(mockClient.monitoring.acknowledgeAlert).mockResolvedValue({
        success: true,
        message: "Alert acknowledged",
      });

      const result = await ctx.api.monitoring.acknowledgeAlert({
        alertId: "alert-1",
        comment: "Investigating",
      });

      expect(result.success).toBe(true);
      expect(mockClient.monitoring.acknowledgeAlert).toHaveBeenCalledWith({
        alertId: "alert-1",
        comment: "Investigating",
      });
    });
  });

  describe("get_health_summary", () => {
    it("returns system health summary", async () => {
      vi.mocked(mockClient.monitoring.healthSummary).mockResolvedValue({
        status: "degraded",
        services: { total: 10, healthy: 8, degraded: 1, unhealthy: 1 },
        alerts: { critical: 1, warning: 2, total: 3 },
        metrics: { avgCpu: 55, avgMemory: 70, errorRate: 0.02 },
      });

      const summary = await ctx.api.monitoring.healthSummary();

      expect(summary.status).toBe("degraded");
      expect(summary.alerts.critical).toBe(1);
      expect(summary.services.healthy).toBe(8);
    });
  });
});

describe("Deployments Tools Integration", () => {
  let mockClient: ControlPanelClient;
  let ctx: McpContext;

  beforeEach(() => {
    mockClient = createMockClient();
    ctx = createMockContext(mockClient);
  });

  describe("trigger_deployment", () => {
    it("triggers a new deployment", async () => {
      vi.mocked(mockClient.deployments.trigger).mockResolvedValue({
        success: true,
        deployment: {
          id: "deploy-1",
          appId: "app-1",
          appName: "Frontend App",
          version: "v1.2.3",
          environment: "production",
          status: "pending",
          triggeredBy: "api",
          commitSha: "abc123",
          commitMessage: "Fix bug",
          imageTag: "v1.2.3",
          startedAt: "2024-06-20T12:00:00Z",
        },
      });

      const result = await ctx.api.deployments.trigger({
        appId: "app-1",
        environment: "production",
        imageTag: "v1.2.3",
      });

      expect(result.success).toBe(true);
      expect(result.deployment.status).toBe("pending");
    });
  });

  describe("rollback_deployment", () => {
    it("rolls back a deployment", async () => {
      vi.mocked(mockClient.deployments.rollback).mockResolvedValue({
        success: true,
        message: "Rollback initiated",
        rollbackDeploymentId: "deploy-2",
      });

      const result = await ctx.api.deployments.rollback({ deploymentId: "deploy-1" });

      expect(result.success).toBe(true);
      expect(result.rollbackDeploymentId).toBe("deploy-2");
    });
  });

  describe("get_deployment_stats", () => {
    it("returns deployment statistics", async () => {
      vi.mocked(mockClient.deployments.stats).mockResolvedValue({
        total: 150,
        succeeded: 140,
        failed: 8,
        running: 1,
        pending: 1,
        successRate: 0.933,
        avgDuration: 180,
        byEnvironment: { production: 50, staging: 60, development: 40 },
      });

      const stats = await ctx.api.deployments.stats();

      expect(stats.total).toBe(150);
      expect(stats.successRate).toBeCloseTo(0.933);
      expect(stats.byEnvironment.production).toBe(50);
    });
  });
});
