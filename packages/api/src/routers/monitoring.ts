/**
 * Monitoring Router
 * 
 * tRPC procedures for monitoring and alerting
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Types for monitoring (exported for type inference)
export interface Alert {
  id: string;
  name: string;
  severity: "critical" | "warning" | "info";
  status: "firing" | "resolved" | "acknowledged";
  source: string;
  message: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface Metric {
  name: string;
  value: number;
  unit: string;
  change: number;
  status: "healthy" | "warning" | "critical";
}

export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latency: number;
  uptime: number;
  lastCheck: string;
  endpoints: {
    name: string;
    url: string;
    status: "up" | "down";
    responseTime: number;
  }[];
}

// Mock data
const mockAlerts: Alert[] = [
  {
    id: "alert-1",
    name: "HighCPUUsage",
    severity: "warning",
    status: "firing",
    source: "prometheus",
    message: "CPU usage above 80% for 5 minutes on k3s-worker-1",
    labels: { instance: "k3s-worker-1", job: "node" },
    annotations: { summary: "High CPU usage detected" },
    startsAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "alert-2",
    name: "PodCrashLooping",
    severity: "critical",
    status: "firing",
    source: "prometheus",
    message: "Pod auth-service-7d8f9c6b5d-x2k4j is crash looping",
    labels: { namespace: "production", pod: "auth-service-7d8f9c6b5d-x2k4j" },
    annotations: { summary: "Pod is restarting frequently" },
    startsAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "alert-3",
    name: "DiskSpaceLow",
    severity: "warning",
    status: "acknowledged",
    source: "prometheus",
    message: "Disk space below 20% on k3s-master-1",
    labels: { instance: "k3s-master-1", mountpoint: "/" },
    annotations: { summary: "Low disk space warning" },
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    acknowledgedBy: "gmackie",
    acknowledgedAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

const mockMetrics: Metric[] = [
  { name: "CPU Usage", value: 45, unit: "%", change: 5, status: "healthy" },
  { name: "Memory Usage", value: 62, unit: "%", change: -3, status: "healthy" },
  { name: "Disk Usage", value: 78, unit: "%", change: 2, status: "warning" },
  { name: "Network In", value: 125, unit: "MB/s", change: 15, status: "healthy" },
  { name: "Network Out", value: 89, unit: "MB/s", change: -8, status: "healthy" },
  { name: "Request Rate", value: 1250, unit: "req/s", change: 120, status: "healthy" },
  { name: "Error Rate", value: 0.5, unit: "%", change: 0.1, status: "healthy" },
  { name: "Latency P99", value: 245, unit: "ms", change: 25, status: "warning" },
];

const mockServices: ServiceHealth[] = [
  {
    name: "API Gateway",
    status: "healthy",
    latency: 45,
    uptime: 99.99,
    lastCheck: new Date().toISOString(),
    endpoints: [
      { name: "Health", url: "/health", status: "up", responseTime: 12 },
      { name: "Metrics", url: "/metrics", status: "up", responseTime: 25 },
    ],
  },
  {
    name: "Auth Service",
    status: "degraded",
    latency: 180,
    uptime: 98.5,
    lastCheck: new Date().toISOString(),
    endpoints: [
      { name: "Health", url: "/health", status: "up", responseTime: 150 },
      { name: "Login", url: "/api/login", status: "up", responseTime: 200 },
    ],
  },
  {
    name: "Database",
    status: "healthy",
    latency: 5,
    uptime: 99.999,
    lastCheck: new Date().toISOString(),
    endpoints: [
      { name: "Connection", url: "tcp://db:5432", status: "up", responseTime: 3 },
    ],
  },
];

export const monitoringRouter = router({
  /**
   * Get active alerts
   */
  alerts: publicProcedure
    .input(z.object({
      status: z.enum(["firing", "resolved", "acknowledged"]).optional(),
      severity: z.enum(["critical", "warning", "info"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      let alerts = [...mockAlerts];
      
      if (input?.status) {
        alerts = alerts.filter((a) => a.status === input.status);
      }
      if (input?.severity) {
        alerts = alerts.filter((a) => a.severity === input.severity);
      }
      
      return alerts.slice(0, input?.limit ?? 50);
    }),

  /**
   * Get alert by ID
   */
  alertById: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const alert = mockAlerts.find((a) => a.id === input);
      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }
      return alert;
    }),

  /**
   * Get alert stats
   */
  alertStats: publicProcedure.query(async () => {
    const alerts = mockAlerts;
    return {
      total: alerts.length,
      firing: alerts.filter((a) => a.status === "firing").length,
      acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
      resolved: alerts.filter((a) => a.status === "resolved").length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === "critical").length,
        warning: alerts.filter((a) => a.severity === "warning").length,
        info: alerts.filter((a) => a.severity === "info").length,
      },
    };
  }),

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const alert = mockAlerts.find((a) => a.id === input.alertId);
      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }
      
      // In production, update the alert in Alertmanager
      return {
        success: true,
        message: `Alert ${input.alertId} acknowledged`,
      };
    }),

  /**
   * Get system metrics
   */
  metrics: publicProcedure.query(async () => {
    return mockMetrics;
  }),

  /**
   * Get service health
   */
  services: publicProcedure.query(async () => {
    return mockServices;
  }),

  /**
   * Get service by name
   */
  serviceByName: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const service = mockServices.find(
        (s) => s.name.toLowerCase() === input.toLowerCase()
      );
      if (!service) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      }
      return service;
    }),

  /**
   * Get overall health summary
   */
  healthSummary: publicProcedure.query(async () => {
    const services = mockServices;
    const alerts = mockAlerts;
    const metrics = mockMetrics;
    
    const healthyServices = services.filter((s) => s.status === "healthy").length;
    const criticalAlerts = alerts.filter(
      (a) => a.severity === "critical" && a.status === "firing"
    ).length;
    
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (criticalAlerts > 0) {
      overallStatus = "unhealthy";
    } else if (healthyServices < services.length) {
      overallStatus = "degraded";
    }
    
    return {
      status: overallStatus,
      services: {
        total: services.length,
        healthy: healthyServices,
        degraded: services.filter((s) => s.status === "degraded").length,
        unhealthy: services.filter((s) => s.status === "unhealthy").length,
      },
      alerts: {
        critical: criticalAlerts,
        warning: alerts.filter((a) => a.severity === "warning" && a.status === "firing").length,
        total: alerts.filter((a) => a.status === "firing").length,
      },
      metrics: {
        avgCpu: metrics.find((m) => m.name === "CPU Usage")?.value ?? 0,
        avgMemory: metrics.find((m) => m.name === "Memory Usage")?.value ?? 0,
        errorRate: metrics.find((m) => m.name === "Error Rate")?.value ?? 0,
      },
    };
  }),
});
