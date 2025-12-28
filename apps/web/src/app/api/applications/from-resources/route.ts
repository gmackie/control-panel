import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPostgresDb, isPostgresConfigured } from "@/lib/db/postgres";
import { 
  applications, 
  applicationRepositories, 
  applicationDeployments 
} from "@/lib/schema-pg";
import { eq } from "drizzle-orm";

// Types for the request
interface LinkedRepository {
  provider: "gitea" | "github" | "gitlab";
  repoId?: string;
  fullName: string;
  name: string;
  owner: string;
  url: string;
  cloneUrl?: string;
  sshUrl?: string;
  defaultBranch?: string;
  description?: string;
  language?: string;
  isPrivate?: boolean;
  role?: "primary" | "mirror" | "archive";
}

interface LinkedDeployment {
  provider: "kubernetes" | "vercel";
  // K8s
  namespace?: string;
  deploymentName?: string;
  serviceName?: string;
  ingressHost?: string;
  // Vercel
  vercelProjectId?: string;
  vercelProjectName?: string;
  // Common
  registryImage?: string;
  environment?: "production" | "staging" | "development";
}

interface CreateFromResourcesRequest {
  name: string;
  slug?: string;
  description?: string;
  repositories: LinkedRepository[];
  deployments?: LinkedDeployment[];
  framework?: string;
  language?: string;
  type?: "web" | "api" | "worker" | "cron";
}

// Helper to get db with proper error handling
async function getDb() {
  if (!isPostgresConfigured()) {
    return null;
  }
  return await getPostgresDb();
}

// GET - Get available resources for linking
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured or connection failed" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId");

    if (appId) {
      // Get linked resources for an existing app
      const repos = await db
        .select()
        .from(applicationRepositories)
        .where(eq(applicationRepositories.applicationId, appId));

      const deploys = await db
        .select()
        .from(applicationDeployments)
        .where(eq(applicationDeployments.applicationId, appId));

      return NextResponse.json({
        repositories: repos,
        deployments: deploys,
      });
    }

    // Return empty - resources come from the Resources page
    return NextResponse.json({
      message: "Use the Resources page to select resources to link",
    });
  } catch (error) {
    console.error("Error fetching linked resources:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}

// POST - Create application from linked resources
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured or connection failed" },
        { status: 503 }
      );
    }

    const body: CreateFromResourcesRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.repositories || body.repositories.length === 0) {
      return NextResponse.json(
        { error: "Name and at least one repository are required" },
        { status: 400 }
      );
    }

    // Generate slug from name if not provided
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Find primary repo for default values
    const primaryRepo = body.repositories.find(r => r.role === "primary") || body.repositories[0];

    // Create the application
    const [app] = await db
      .insert(applications)
      .values({
        name: body.name,
        slug,
        description: body.description || primaryRepo.description,
        repositoryUrl: primaryRepo.url,
        repositoryFullName: primaryRepo.fullName,
        defaultBranch: primaryRepo.defaultBranch || "main",
        language: body.language || primaryRepo.language,
        framework: body.framework,
        type: body.type || "web",
        status: "unknown",
        giteaRepoId: primaryRepo.provider === "gitea" && primaryRepo.repoId 
          ? parseInt(primaryRepo.repoId) 
          : null,
      })
      .returning();

    // Link all repositories
    const repoInserts = body.repositories.map((repo, index) => ({
      applicationId: app.id,
      provider: repo.provider,
      repoId: repo.repoId,
      fullName: repo.fullName,
      name: repo.name,
      owner: repo.owner,
      url: repo.url,
      cloneUrl: repo.cloneUrl,
      sshUrl: repo.sshUrl,
      defaultBranch: repo.defaultBranch || "main",
      description: repo.description,
      language: repo.language,
      isPrivate: repo.isPrivate || false,
      role: repo.role || (index === 0 ? "primary" : "mirror"),
      syncEnabled: true,
    }));

    await db.insert(applicationRepositories).values(repoInserts);

    // Link deployments if provided
    if (body.deployments && body.deployments.length > 0) {
      const deployInserts = body.deployments.map((deploy) => ({
        applicationId: app.id,
        provider: deploy.provider,
        namespace: deploy.namespace,
        deploymentName: deploy.deploymentName,
        serviceName: deploy.serviceName,
        ingressHost: deploy.ingressHost,
        vercelProjectId: deploy.vercelProjectId,
        vercelProjectName: deploy.vercelProjectName,
        registryImage: deploy.registryImage,
        environment: deploy.environment || "production",
        status: "unknown",
      }));

      await db.insert(applicationDeployments).values(deployInserts);
    }

    // Fetch the complete app with relations
    const [createdApp] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, app.id));

    const linkedRepos = await db
      .select()
      .from(applicationRepositories)
      .where(eq(applicationRepositories.applicationId, app.id));

    const linkedDeploys = await db
      .select()
      .from(applicationDeployments)
      .where(eq(applicationDeployments.applicationId, app.id));

    return NextResponse.json({
      application: createdApp,
      repositories: linkedRepos,
      deployments: linkedDeploys,
    });
  } catch (error) {
    console.error("Error creating application from resources:", error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "An application with this name or slug already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create application", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT - Update linked resources for an existing app
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured or connection failed" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId");

    if (!appId) {
      return NextResponse.json(
        { error: "appId is required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Update repositories if provided
    if (body.repositories) {
      // Delete existing and insert new
      await db
        .delete(applicationRepositories)
        .where(eq(applicationRepositories.applicationId, appId));

      if (body.repositories.length > 0) {
        const repoInserts = body.repositories.map((repo: LinkedRepository, index: number) => ({
          applicationId: appId,
          provider: repo.provider,
          repoId: repo.repoId,
          fullName: repo.fullName,
          name: repo.name,
          owner: repo.owner,
          url: repo.url,
          cloneUrl: repo.cloneUrl,
          sshUrl: repo.sshUrl,
          defaultBranch: repo.defaultBranch || "main",
          description: repo.description,
          language: repo.language,
          isPrivate: repo.isPrivate || false,
          role: repo.role || (index === 0 ? "primary" : "mirror"),
          syncEnabled: true,
        }));

        await db.insert(applicationRepositories).values(repoInserts);
      }
    }

    // Update deployments if provided
    if (body.deployments) {
      await db
        .delete(applicationDeployments)
        .where(eq(applicationDeployments.applicationId, appId));

      if (body.deployments.length > 0) {
        const deployInserts = body.deployments.map((deploy: LinkedDeployment) => ({
          applicationId: appId,
          provider: deploy.provider,
          namespace: deploy.namespace,
          deploymentName: deploy.deploymentName,
          serviceName: deploy.serviceName,
          ingressHost: deploy.ingressHost,
          vercelProjectId: deploy.vercelProjectId,
          vercelProjectName: deploy.vercelProjectName,
          registryImage: deploy.registryImage,
          environment: deploy.environment || "production",
          status: "unknown",
        }));

        await db.insert(applicationDeployments).values(deployInserts);
      }
    }

    // Fetch updated data
    const linkedRepos = await db
      .select()
      .from(applicationRepositories)
      .where(eq(applicationRepositories.applicationId, appId));

    const linkedDeploys = await db
      .select()
      .from(applicationDeployments)
      .where(eq(applicationDeployments.applicationId, appId));

    return NextResponse.json({
      repositories: linkedRepos,
      deployments: linkedDeploys,
    });
  } catch (error) {
    console.error("Error updating linked resources:", error);
    return NextResponse.json(
      { error: "Failed to update resources" },
      { status: 500 }
    );
  }
}
