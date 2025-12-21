import { NextResponse } from "next/server";
import { deploymentsRepo, applicationsRepo, commitsRepo } from "@/lib/db/repositories";
import { isPostgresConfigured } from "@/lib/db/postgres";

export async function GET() {
  try {
    // Try to get real deployments from PostgreSQL
    if (isPostgresConfigured()) {
      const recentDeployments = await deploymentsRepo.getRecentDeployments(10);
      
      if (recentDeployments && recentDeployments.length > 0) {
        // Enrich with application and commit data
        const enrichedDeployments = await Promise.all(
          recentDeployments.map(async (deployment: any) => {
            // Get application info
            const app = deployment.applicationId 
              ? await applicationsRepo.getById(deployment.applicationId)
              : null;
            
            // Get commit info if we have a commit ID
            let commit = null;
            if (deployment.commitId) {
              commit = await commitsRepo.getById(deployment.commitId);
            }
            
            return {
              id: deployment.id,
              name: deployment.deploymentName,
              namespace: deployment.namespace,
              repository: app?.repositoryFullName || app?.name || deployment.deploymentName,
              branch: commit?.branch || "main",
              commit: commit?.shortSha || deployment.imageTag?.replace("sha-", "") || "latest",
              commitMessage: commit?.message || `Deployed ${deployment.imageTag}`,
              author: deployment.deployedBy || "system",
              timestamp: deployment.deployedAt?.toISOString() || deployment.createdAt?.toISOString() || new Date().toISOString(),
              status: deployment.status === "deployed" ? "success" : 
                      deployment.status === "failed" ? "failed" :
                      deployment.status === "pending" ? "pending" : "running",
              environment: deployment.environment,
              url: deployment.url,
            };
          })
        );
        
        return NextResponse.json(enrichedDeployments);
      }
    }
    
    // Fallback to mock data if no real deployments available
    const mockDeployments = [
      {
        id: "deploy-1",
        name: "control-panel",
        namespace: "control-panel",
        repository: "gmac/control-panel",
        branch: "main",
        commit: "50f5c3c",
        commitMessage: "fix: PostgreSQL connection and add database migration endpoint",
        author: "gmackie",
        timestamp: new Date().toISOString(),
        status: "success",
        environment: "production",
        url: "https://control.gmac.io",
      },
    ];

    return NextResponse.json(mockDeployments);
  } catch (error) {
    console.error("Error fetching recent deployments:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent deployments" },
      { status: 500 }
    );
  }
}
