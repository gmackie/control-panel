import { NextRequest, NextResponse } from "next/server";
import { getAllIntegrations, createIntegration } from "@/lib/db-utils";

export async function GET(request: NextRequest) {
  try {
    const integrations = await getAllIntegrations();

    // For now, return mock data until we have real integration data
    const mockIntegrations = [
      {
        id: "stripe-1",
        name: "Stripe Payments",
        type: "stripe",
        provider: "stripe",
        status: "active",
        config: JSON.stringify({
          apiKey: "sk_test_...",
          webhookSecret: "whsec_...",
          environment: "test",
        }),
        lastChecked: new Date().toISOString(),
        healthStatus: "healthy",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "turso-1",
        name: "Turso Database",
        type: "turso",
        provider: "turso",
        status: "active",
        config: JSON.stringify({
          databaseUrl: "libsql://...",
          authToken: "eyJ...",
          databaseName: "control-panel",
        }),
        lastChecked: new Date().toISOString(),
        healthStatus: "healthy",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "webhook-1",
        name: "GitHub Webhook",
        type: "webhook",
        provider: "github",
        status: "active",
        config: JSON.stringify({
          url: "https://api.github.com/webhooks",
          secret: "webhook_secret",
          events: ["push", "pull_request"],
        }),
        lastChecked: new Date().toISOString(),
        healthStatus: "healthy",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json(mockIntegrations);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, provider, config } = body;

    // Validate required fields
    if (!name || !type || !provider || !config) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const integration = await createIntegration({
      id: `${type}-${Date.now()}`,
      name,
      type,
      provider,
      status: "active",
      config: JSON.stringify(config),
      lastChecked: new Date().toISOString(),
      healthStatus: "unknown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    console.error("Error creating integration:", error);
    return NextResponse.json(
      { error: "Failed to create integration" },
      { status: 500 }
    );
  }
}
