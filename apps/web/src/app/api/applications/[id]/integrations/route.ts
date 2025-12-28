import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPostgresDb, isPostgresConfigured } from "@/lib/db/postgres";
import { 
  applications,
  applicationIntegrations,
} from "@/lib/schema-pg";
import { eq, and } from "drizzle-orm";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// Helper to get db with proper error handling
async function getDb() {
  if (!isPostgresConfigured()) {
    return null;
  }
  return await getPostgresDb();
}

// GET - List all integrations for an application
export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const applicationId = params.id;

    // Verify application exists
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId));

    if (!app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Get all integrations for this application
    const integrations = await db
      .select()
      .from(applicationIntegrations)
      .where(eq(applicationIntegrations.applicationId, applicationId));

    // Transform to match the expected format
    const formattedIntegrations = integrations.map((i: typeof integrations[number]) => ({
      id: i.id,
      provider: i.provider,
      name: i.name,
      enabled: i.status === "active",
      config: i.config || {},
      secrets: [], // Secrets are stored separately
      status: i.status === "active" ? "connected" : i.status === "error" ? "error" : "disconnected",
      lastSyncAt: i.lastHealthCheck?.toISOString(),
      healthStatus: i.healthStatus,
      healthMessage: i.healthMessage,
    }));

    return NextResponse.json(formattedIntegrations);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// POST - Add a new integration to an application
export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const applicationId = params.id;
    const body = await request.json();

    // Validate required fields
    if (!body.provider || !body.name) {
      return NextResponse.json(
        { error: "Provider and name are required" },
        { status: 400 }
      );
    }

    // Verify application exists
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId));

    if (!app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Check if integration already exists
    const [existing] = await db
      .select()
      .from(applicationIntegrations)
      .where(
        and(
          eq(applicationIntegrations.applicationId, applicationId),
          eq(applicationIntegrations.provider, body.provider)
        )
      );

    if (existing) {
      return NextResponse.json(
        { error: "Integration already exists for this provider" },
        { status: 409 }
      );
    }

    // Create the integration
    const [integration] = await db
      .insert(applicationIntegrations)
      .values({
        applicationId,
        provider: body.provider,
        name: body.name,
        status: body.enabled !== false ? "active" : "inactive",
        config: body.config || {},
        healthStatus: "unknown",
      })
      .returning();

    // Return in expected format
    const formatted = {
      id: integration.id,
      provider: integration.provider,
      name: integration.name,
      enabled: integration.status === "active",
      config: integration.config || {},
      secrets: body.secrets || [],
      status: "connected" as const,
      lastSyncAt: new Date().toISOString(),
    };

    return NextResponse.json(formatted, { status: 201 });
  } catch (error) {
    console.error("Error creating integration:", error);
    return NextResponse.json(
      { error: "Failed to create integration" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing integration
export async function PUT(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const applicationId = params.id;
    const body = await request.json();

    if (!body.provider && !body.integrationId) {
      return NextResponse.json(
        { error: "Provider or integrationId is required" },
        { status: 400 }
      );
    }

    // Find the existing integration
    let existing;
    if (body.integrationId) {
      [existing] = await db
        .select()
        .from(applicationIntegrations)
        .where(eq(applicationIntegrations.id, body.integrationId));
    } else {
      [existing] = await db
        .select()
        .from(applicationIntegrations)
        .where(
          and(
            eq(applicationIntegrations.applicationId, applicationId),
            eq(applicationIntegrations.provider, body.provider)
          )
        );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // Update the integration
    const [updated] = await db
      .update(applicationIntegrations)
      .set({
        name: body.name ?? existing.name,
        status: body.enabled !== undefined 
          ? (body.enabled ? "active" : "inactive") 
          : existing.status,
        config: body.config !== undefined ? body.config : existing.config,
        updatedAt: new Date(),
      })
      .where(eq(applicationIntegrations.id, existing.id))
      .returning();

    // Return in expected format
    const formatted = {
      id: updated.id,
      provider: updated.provider,
      name: updated.name,
      enabled: updated.status === "active",
      config: updated.config || {},
      secrets: [],
      status: updated.status === "active" ? "connected" : updated.status === "error" ? "error" : "disconnected",
      lastSyncAt: updated.updatedAt?.toISOString(),
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json(
      { error: "Failed to update integration" },
      { status: 500 }
    );
  }
}

// DELETE - Remove an integration
export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const applicationId = params.id;
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const integrationId = searchParams.get("integrationId");

    if (!provider && !integrationId) {
      return NextResponse.json(
        { error: "Provider or integrationId query parameter is required" },
        { status: 400 }
      );
    }

    // Delete the integration
    let deleted;
    if (integrationId) {
      deleted = await db
        .delete(applicationIntegrations)
        .where(eq(applicationIntegrations.id, integrationId))
        .returning();
    } else {
      deleted = await db
        .delete(applicationIntegrations)
        .where(
          and(
            eq(applicationIntegrations.applicationId, applicationId),
            eq(applicationIntegrations.provider, provider!)
          )
        )
        .returning();
    }

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: deleted[0] });
  } catch (error) {
    console.error("Error deleting integration:", error);
    return NextResponse.json(
      { error: "Failed to delete integration" },
      { status: 500 }
    );
  }
}
