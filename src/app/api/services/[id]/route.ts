import { NextRequest, NextResponse } from "next/server";
import { AppService } from "@/types";

// Mock data - replace with actual database queries
const mockServices: Record<string, AppService> = {
  "1": {
    id: "1",
    name: "Control Panel",
    type: "nextjs",
    status: "healthy",
    uptime: "99.9%",
    version: "1.0.0",
    environment: "production",
    url: "https://control.gmac.io",
    lastChecked: new Date().toISOString(),
    metrics: {
      cpu: 45,
      memory: 67,
      requests: 1234,
      responseTime: 120,
      errorRate: 0.1,
    },
    integrations: {
      stripe: true,
      turso: true,
    },
  },
  "2": {
    id: "2",
    name: "API Gateway",
    type: "go-api",
    status: "healthy",
    uptime: "99.8%",
    version: "2.1.0",
    environment: "production",
    url: "https://api.gmac.io",
    lastChecked: new Date().toISOString(),
    metrics: {
      cpu: 23,
      memory: 45,
      requests: 5678,
      responseTime: 85,
      errorRate: 0.05,
    },
    integrations: {
      stripe: true,
      turso: false,
    },
  },
  "3": {
    id: "3",
    name: "Background Worker",
    type: "worker",
    status: "warning",
    uptime: "98.5%",
    version: "1.2.0",
    environment: "production",
    lastChecked: new Date().toISOString(),
    metrics: {
      cpu: 78,
      memory: 89,
      requests: 0,
      responseTime: 0,
      errorRate: 2.1,
    },
    integrations: {
      stripe: false,
      turso: true,
    },
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = mockServices[params.id];

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json(service);
  } catch (error) {
    console.error("Failed to fetch service:", error);
    return NextResponse.json(
      { error: "Failed to fetch service" },
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

    // In production, update service in database
    const updatedService = {
      ...mockServices[params.id],
      ...body,
    };

    return NextResponse.json(updatedService);
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json(
      { error: "Failed to update service" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // In production, delete service from database and K8s
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 }
    );
  }
}
