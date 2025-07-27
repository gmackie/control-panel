import { NextRequest, NextResponse } from "next/server";
import { getAllServices, createService } from "@/lib/db-utils";

export async function GET(request: NextRequest) {
  try {
    const services = await getAllServices();
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
