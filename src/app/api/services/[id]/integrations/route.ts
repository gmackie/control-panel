import { NextRequest, NextResponse } from "next/server";
import { Integration } from "@/types";

// Mock data - replace with actual database queries
const mockIntegrations: Record<string, Integration[]> = {
  "1": [
    {
      id: "2",
      serviceId: "1",
      type: "payment",
      provider: "stripe",
      name: "Stripe Payments",
      config: {
        publishableKey: "pk_test_...",
        secretKey: "sk_test_...",
        webhookSecret: "whsec_...",
      },
      status: "active",
      lastChecked: new Date().toISOString(),
      apiKeys: ["stripe-publishable-key", "stripe-secret-key"],
      webhooks: ["https://control.gmac.io/api/webhooks/stripe"],
    },
    {
      id: "3",
      serviceId: "1",
      type: "database",
      provider: "turso",
      name: "Turso Database",
      config: {
        databaseUrl: "libsql://...",
        authToken: "...",
      },
      status: "active",
      lastChecked: new Date().toISOString(),
      apiKeys: ["turso-auth-token"],
    },
  ],
  "2": [
    {
      id: "4",
      serviceId: "2",
      type: "payment",
      provider: "stripe",
      name: "Stripe Payments",
      config: {
        publishableKey: "pk_test_...",
        secretKey: "sk_test_...",
      },
      status: "active",
      lastChecked: new Date().toISOString(),
      apiKeys: ["stripe-publishable-key", "stripe-secret-key"],
    },
  ],
  "3": [
    {
      id: "5",
      serviceId: "3",
      type: "database",
      provider: "turso",
      name: "Turso Database",
      config: {
        databaseUrl: "libsql://...",
        authToken: "...",
      },
      status: "active",
      lastChecked: new Date().toISOString(),
      apiKeys: ["turso-auth-token"],
    },
  ],
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const integrations = mockIntegrations[params.id] || [];
    return NextResponse.json(integrations);
  } catch (error) {
    console.error("Failed to fetch integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // In production, create integration in database
    const newIntegration: Integration = {
      id: Date.now().toString(),
      serviceId: params.id,
      ...body,
      status: "active",
      lastChecked: new Date().toISOString(),
      apiKeys: body.apiKeys || [],
    };

    return NextResponse.json(newIntegration, { status: 201 });
  } catch (error) {
    console.error("Failed to create integration:", error);
    return NextResponse.json(
      { error: "Failed to create integration" },
      { status: 500 }
    );
  }
}
