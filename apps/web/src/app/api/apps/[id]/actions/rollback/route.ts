import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/apps/[id]/actions/rollback
 * 
 * Rolls back to the previous deployment revision
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appId = decodeURIComponent(params.id);
    
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
    let namespace = "default";
    let deploymentName = appId;
    
    if (appId.includes("/")) {
      const parts = appId.split("/");
      if (parts.length === 2) {
        namespace = parts[0];
        deploymentName = parts[1];
      }
    }

    // First, get the deployment to find its revision history
    const deploymentResponse = await fetch(
      `${k3sApiUrl}/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`,
      {
        headers: {
          Authorization: `Bearer ${k3sToken}`,
        },
      }
    );

    if (!deploymentResponse.ok) {
      return NextResponse.json(
        { 
          success: false,
          error: "Deployment not found",
          message: `Deployment ${namespace}/${deploymentName} not found`
        },
        { status: 404 }
      );
    }

    const deployment = await deploymentResponse.json();
    const currentRevision = deployment.metadata?.annotations?.["deployment.kubernetes.io/revision"];
    
    if (!currentRevision || parseInt(currentRevision) <= 1) {
      return NextResponse.json(
        { 
          success: false,
          error: "No previous revision available",
          message: "This is the first revision, cannot rollback"
        },
        { status: 400 }
      );
    }

    // Get the replica sets to find the previous one
    const rsResponse = await fetch(
      `${k3sApiUrl}/apis/apps/v1/namespaces/${namespace}/replicasets?labelSelector=app=${deploymentName}`,
      {
        headers: {
          Authorization: `Bearer ${k3sToken}`,
        },
      }
    );

    if (!rsResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get replica sets" },
        { status: 500 }
      );
    }

    const replicaSets = await rsResponse.json();
    
    // Find the previous replica set (one with revision - 1)
    const targetRevision = parseInt(currentRevision) - 1;
    const previousRS = replicaSets.items?.find((rs: any) => 
      rs.metadata?.annotations?.["deployment.kubernetes.io/revision"] === String(targetRevision)
    );

    if (!previousRS) {
      return NextResponse.json(
        { 
          success: false,
          error: "Previous revision not found",
          message: `Could not find replica set for revision ${targetRevision}`
        },
        { status: 400 }
      );
    }

    // Perform rollback by patching the deployment with the previous template
    const patchBody = {
      spec: {
        template: previousRS.spec.template,
      },
    };

    const rollbackResponse = await fetch(
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

    if (!rollbackResponse.ok) {
      const error = await rollbackResponse.text();
      console.error("Kubernetes rollback error:", error);
      
      return NextResponse.json(
        { error: "Failed to rollback deployment" },
        { status: 500 }
      );
    }

    const result = await rollbackResponse.json();

    return NextResponse.json({
      success: true,
      message: `Rolled back ${deploymentName} from revision ${currentRevision} to ${targetRevision}`,
      deployment: {
        name: result.metadata?.name,
        namespace: result.metadata?.namespace,
        previousRevision: currentRevision,
        targetRevision: targetRevision,
      },
    });
  } catch (error) {
    console.error("Error rolling back deployment:", error);
    return NextResponse.json(
      { 
        error: "Failed to rollback deployment",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
