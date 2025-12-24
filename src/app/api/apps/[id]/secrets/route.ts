import { NextRequest, NextResponse } from "next/server";
import { applicationsRepo } from "@/lib/db/repositories";
import { encryptSecret, maskSecret } from "@/lib/crypto/secrets";

/**
 * GET /api/apps/[id]/secrets
 * 
 * Returns secrets for an application (values are masked)
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get("environment") || undefined;
    
    // Get application from DB
    const app = (await applicationsRepo.getBySlug(appId)) 
      || (await applicationsRepo.getByRepository(appId));
    
    if (!app) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }
    
    // Get secrets
    const secrets = await applicationsRepo.getSecrets(app.id, environment);
    
    // Mask values before returning
    const maskedSecrets = secrets.map((secret: {
      id: string;
      name: string;
      environment: string;
      description: string | null;
      encryptedValue: string;
      isRotating: boolean | null;
      lastRotatedAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
    }) => ({
      id: secret.id,
      name: secret.name,
      environment: secret.environment,
      description: secret.description,
      maskedValue: maskSecret(secret.encryptedValue), // Show that there's a value
      isRotating: secret.isRotating,
      lastRotatedAt: secret.lastRotatedAt,
      expiresAt: secret.expiresAt,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      createdBy: secret.createdBy,
    }));
    
    return NextResponse.json({
      success: true,
      data: maskedSecrets,
      count: maskedSecrets.length,
    });
  } catch (error) {
    console.error("Failed to fetch secrets:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch secrets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/apps/[id]/secrets
 * 
 * Create or update a secret for an application
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const body = await request.json();
    
    const { name, value, environment = "all", description } = body;
    
    if (!name || !value) {
      return NextResponse.json(
        { success: false, error: "Name and value are required" },
        { status: 400 }
      );
    }
    
    // Validate name format (alphanumeric and underscores)
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Secret name must be uppercase, start with a letter, and contain only letters, numbers, and underscores" 
        },
        { status: 400 }
      );
    }
    
    // Get application from DB
    const app = (await applicationsRepo.getBySlug(appId)) 
      || (await applicationsRepo.getByRepository(appId));
    
    if (!app) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }
    
    // Encrypt the secret value
    const { encryptedValue, iv } = encryptSecret(value);
    
    // Upsert the secret
    const secret = await applicationsRepo.upsertSecret({
      applicationId: app.id,
      name,
      encryptedValue,
      iv,
      environment,
      description,
      createdBy: "api", // TODO: Get from auth session
    });
    
    return NextResponse.json({
      success: true,
      data: {
        id: secret.id,
        name: secret.name,
        environment: secret.environment,
        description: secret.description,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
      },
      message: `Secret ${name} saved successfully`,
    });
  } catch (error) {
    console.error("Failed to save secret:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to save secret",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/apps/[id]/secrets
 * 
 * Delete a secret from an application
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const environment = searchParams.get("environment") || "all";
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Secret name is required" },
        { status: 400 }
      );
    }
    
    // Get application from DB
    const app = (await applicationsRepo.getBySlug(appId)) 
      || (await applicationsRepo.getByRepository(appId));
    
    if (!app) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }
    
    // Delete the secret
    await applicationsRepo.deleteSecret(app.id, name, environment);
    
    return NextResponse.json({
      success: true,
      message: `Secret ${name} deleted successfully`,
    });
  } catch (error) {
    console.error("Failed to delete secret:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to delete secret",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
