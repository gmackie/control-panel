import { NextRequest, NextResponse } from "next/server";
import { getRecentDeployments } from "@/lib/db-utils";

export async function GET(request: NextRequest) {
  try {
    const deployments = await getRecentDeployments();

    // For now, return mock data until we have real deployment data
    // In production, this would fetch from the database
    const mockDeployments = [
      {
        id: "deploy-1",
        name: "classcheck-frontend",
        namespace: "production",
        repository: "mackieg/classcheck",
        branch: "main",
        commit: "a1b2c3d4",
        commitMessage: "Fix authentication flow",
        author: "gmackie",
        timestamp: "2025-07-27T15:30:00Z",
        status: "success",
        environment: "production",
        url: "https://classcheck.gmac.io",
      },
      {
        id: "deploy-2",
        name: "classback",
        namespace: "production",
        repository: "mackieg/classback",
        branch: "main",
        commit: "e5f6g7h8",
        commitMessage: "Add user management API",
        author: "gmackie",
        timestamp: "2025-07-27T14:15:00Z",
        status: "success",
        environment: "production",
        url: "https://api.classcheck.gmac.io",
      },
      {
        id: "deploy-3",
        name: "turntable-bot",
        namespace: "production",
        repository: "mackieg/turntable-bot",
        branch: "main",
        commit: "i9j0k1l2",
        commitMessage: "Update AI model integration",
        author: "gmackie",
        timestamp: "2025-07-27T13:45:00Z",
        status: "success",
        environment: "production",
        url: "https://turntable.gmac.io",
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
