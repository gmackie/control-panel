import { NextRequest, NextResponse } from "next/server";
import { AppService } from "@/types";

// Mock app services - replace with actual monitoring
export async function GET(request: NextRequest) {
  try {
    // In production, aggregate data from:
    // - Kubernetes deployments
    // - Prometheus metrics
    // - Application health endpoints
    // - Git repository info

    const mockApps: AppService[] = [
      {
        id: "app-1",
        name: "SaaS Dashboard",
        type: "nextjs",
        status: "healthy",
        uptime: "15d 8h",
        version: "v2.3.1",
        environment: "production",
        url: "https://app.example.com",
        lastChecked: new Date().toISOString(),
        metrics: {
          cpu: 23.5,
          memory: 45.2,
          requests: 15234,
          responseTime: 125,
          errorRate: 0.05,
        },
        integrations: {
          stripe: true,
          turso: true,
        },
      },
      {
        id: "api-1",
        name: "Core API",
        type: "go-api",
        status: "healthy",
        uptime: "30d 14h",
        version: "v1.8.0",
        environment: "production",
        url: "https://api.example.com",
        lastChecked: new Date().toISOString(),
        metrics: {
          cpu: 18.2,
          memory: 32.8,
          requests: 89432,
          responseTime: 45,
          errorRate: 0.02,
        },
        integrations: {
          stripe: true,
          turso: true,
        },
      },
      {
        id: "app-2",
        name: "Admin Portal",
        type: "nextjs",
        status: "warning",
        uptime: "5d 2h",
        version: "v1.2.0",
        environment: "staging",
        url: "https://admin-staging.example.com",
        lastChecked: new Date().toISOString(),
        metrics: {
          cpu: 65.8,
          memory: 78.3,
          requests: 2341,
          responseTime: 234,
          errorRate: 1.2,
        },
        integrations: {
          stripe: false,
          turso: true,
        },
      },
      {
        id: "worker-1",
        name: "Email Worker",
        type: "worker",
        status: "healthy",
        uptime: "10d 5h",
        version: "v1.0.3",
        environment: "production",
        lastChecked: new Date().toISOString(),
        metrics: {
          cpu: 12.4,
          memory: 28.1,
          requests: 5432,
        },
        integrations: {
          turso: true,
        },
      },
      {
        id: "api-2",
        name: "Analytics API",
        type: "go-api",
        status: "healthy",
        uptime: "20d 18h",
        version: "v2.1.0",
        environment: "production",
        url: "https://analytics.example.com",
        lastChecked: new Date().toISOString(),
        metrics: {
          cpu: 35.2,
          memory: 52.7,
          requests: 23456,
          responseTime: 78,
          errorRate: 0.08,
        },
        integrations: {
          turso: true,
        },
      },
      {
        id: "app-3",
        name: "Customer Portal",
        type: "nextjs",
        status: "error",
        uptime: "0h",
        version: "v3.0.0",
        environment: "development",
        url: "https://customer-dev.example.com",
        lastChecked: new Date().toISOString(),
        metrics: {
          cpu: 0,
          memory: 0,
          requests: 0,
          responseTime: 0,
          errorRate: 100,
        },
        integrations: {
          stripe: true,
          turso: true,
        },
      },
    ];

    return NextResponse.json(mockApps);
  } catch (error) {
    console.error("Failed to fetch app services:", error);
    return NextResponse.json(
      { error: "Failed to fetch app services" },
      { status: 500 }
    );
  }
}
