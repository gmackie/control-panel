import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/[id]/deployments
 * 
 * Returns K8s deployments for an application
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    
    const deployments = await unifiedAppService.getDeployments(appId);
    
    return NextResponse.json({
      success: true,
      data: deployments,
      count: deployments.length,
    });
  } catch (error) {
    console.error("Failed to fetch deployments:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch deployments",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/apps/[id]/deployments
 * 
 * Trigger a new deployment for an application
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const body = await request.json();
    
    const { environment = "staging", commitSha, imageTag } = body;
    
    if (!["staging", "production"].includes(environment)) {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid environment. Must be 'staging' or 'production'",
        },
        { status: 400 }
      );
    }
    
    const result = await unifiedAppService.triggerDeployment(appId, environment, {
      commitSha,
      imageTag,
    });
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      deploymentId: result.deploymentId,
    }, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Failed to trigger deployment:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to trigger deployment",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
