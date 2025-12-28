import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";
import { getServerSession } from "next-auth";

/**
 * POST /api/apps/sync
 * 
 * Sync all applications from Gitea to PostgreSQL
 * This discovers apps from Gitea and creates/updates records in the database
 * 
 * Authentication:
 * - Session auth (via NextAuth)
 * - Bearer token auth (via WEBHOOK_SECRET/NEXTAUTH_SECRET)
 */
export async function POST(request: NextRequest) {
  // Check for Bearer token auth (for programmatic access)
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET;
  
  const isBearerAuth = authHeader && expectedSecret && authHeader === `Bearer ${expectedSecret}`;
  
  // If no bearer auth, check for session auth
  if (!isBearerAuth) {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await unifiedAppService.syncAllApplications();
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `Synced ${result.synced} applications, ${result.failed} failed`,
    });
  } catch (error) {
    console.error("Failed to sync applications:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to sync applications",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
