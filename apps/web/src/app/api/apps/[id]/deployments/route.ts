import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { K3sService } from "@/lib/k3s/k3s-service";

const k3sService = new K3sService();

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appId = decodeURIComponent(params.id);
    const appName = appId.includes("/") ? (appId.split("/")[1] ?? appId) : appId;
    const { searchParams } = new URL(request.url);
    const namespace = searchParams.get("namespace") || undefined;
    const environment = searchParams.get("environment") || undefined;
    
    const k3sDeployments = await k3sService.getDeployments({
      namespace,
      environment,
      labels: { app: appName },
    });
    
    const deployments = k3sDeployments.map((dep) => ({
      id: `${dep.namespace}/${dep.name}`,
      name: dep.name,
      namespace: dep.namespace,
      environment: dep.labels.environment || dep.namespace,
      status: dep.readyReplicas === dep.replicas ? "healthy" : 
              dep.readyReplicas > 0 ? "degraded" : "unhealthy",
      replicas: {
        desired: dep.replicas,
        ready: dep.readyReplicas,
        available: dep.availableReplicas,
      },
      image: dep.image,
      labels: dep.labels,
      conditions: dep.conditions,
      createdAt: dep.creationTimestamp,
    }));
    
    return NextResponse.json({
      success: true,
      data: deployments,
      count: deployments.length,
      appId,
      appName,
    });
  } catch (error) {
    console.error("Failed to fetch deployments:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch deployments",
        message: error instanceof Error ? error.message : "Unknown error",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appId = decodeURIComponent(params.id);
    const appName = appId.includes("/") ? (appId.split("/")[1] ?? appId) : appId;
    const body = await request.json();
    
    const { 
      environment = "staging",
      namespace,
      image,
      replicas = 1,
      envVars,
      port,
    } = body;
    
    if (!["staging", "production"].includes(environment)) {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid environment. Must be 'staging' or 'production'",
        },
        { status: 400 }
      );
    }
    
    if (!image) {
      return NextResponse.json(
        { 
          success: false,
          error: "Image is required for deployment",
        },
        { status: 400 }
      );
    }
    
    const result = await k3sService.deployApplication({
      namespace: namespace || environment,
      appName,
      image,
      replicas,
      environment,
      labels: { app: appName, environment },
      envVars,
      port,
    });
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Deployment failed",
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Deployment to ${environment} initiated for ${appName}`,
      deploymentId: `${namespace || environment}/${appName}`,
    });
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
