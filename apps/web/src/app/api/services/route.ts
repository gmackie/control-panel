import { NextRequest, NextResponse } from "next/server";
import { getAllServices, createService } from "@/lib/db-utils";
import { getK3sServiceStatus } from "@/lib/monitoring/k3s-service-monitor";

export async function GET(request: NextRequest) {
  try {
    // Get real-time service status from k3s
    const k3sServices = await getK3sServiceStatus();
    
    // Get any additional services from database
    const dbServices = await getAllServices();
    
    // Merge services, preferring real-time data
    const serviceMap = new Map();
    
    // Add k3s services first (real-time data)
    k3sServices.forEach(service => {
      serviceMap.set(service.id, service);
    });
    
    // Add any additional services from DB that aren't already tracked
    dbServices.forEach((service: any) => {
      if (service && service.id && !serviceMap.has(service.id)) {
        serviceMap.set(service.id, service);
      }
    });
    
    const services = Array.from(serviceMap.values());
    return NextResponse.json(services);
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, config } = body;

    const serviceData = {
      id: Date.now().toString(),
      name: config.name,
      type: template || "custom",
      status: "unknown",
      uptime: "0%",
      version: "1.0.0",
      environment: config.environment || "development",
      url: config.domains?.[0] ? `https://${config.domains[0]}` : undefined,
      lastChecked: new Date().toISOString(),
    };

    await createService(serviceData);

    return NextResponse.json(serviceData, { status: 201 });
  } catch (error) {
    console.error("Failed to create service:", error);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    );
  }
}
