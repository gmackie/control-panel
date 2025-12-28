import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/apps/[id]/actions/deploy
 * 
 * Triggers a deployment for the application
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appId = decodeURIComponent(params.id);
    const body = await request.json().catch(() => ({}));
    const environment = body.environment || "production";
    
    // Get K3s service account token
    const k3sToken = process.env.K3S_SA_TOKEN;
    const k3sApiUrl = process.env.K3S_API_URL || "https://k8s.gmac.io:6443";
    
    if (!k3sToken) {
      return NextResponse.json(
        { error: "Kubernetes token not configured" },
        { status: 503 }
      );
    }

    // Extract namespace and deployment name from appId
    // Format could be: namespace/deployment or just deployment (defaults to 'default' namespace)
    let namespace = "default";
    let deploymentName = appId;
    
    if (appId.includes("/")) {
      const parts = appId.split("/");
      if (parts.length === 2) {
        namespace = parts[0];
        deploymentName = parts[1];
      }
    }

    // Restart the deployment by patching with a new annotation
    // This triggers a rolling update
    const patchBody = {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
            },
          },
        },
      },
    };

    const response = await fetch(
      `${k3sApiUrl}/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${k3sToken}`,
          "Content-Type": "application/strategic-merge-patch+json",
        },
        body: JSON.stringify(patchBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Kubernetes deploy error:", error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to trigger deployment",
          message: `Deployment ${namespace}/${deploymentName} not found or access denied`
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: `Deployment ${deploymentName} restarted in ${namespace}`,
      environment,
      deployment: {
        name: result.metadata?.name,
        namespace: result.metadata?.namespace,
        generation: result.metadata?.generation,
      },
    });
  } catch (error) {
    console.error("Error triggering deployment:", error);
    return NextResponse.json(
      { 
        error: "Failed to trigger deployment",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
