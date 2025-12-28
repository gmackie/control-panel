/**
 * Application Provisioner
 * 
 * Orchestrates the complete app creation workflow:
 * 1. Create app record in PostgreSQL
 * 2. Create Gitea repository (with template if specified)
 * 3. Configure integrations and store secrets
 * 4. Create Kubernetes namespace and resources
 * 5. Set up CI/CD workflows
 */

import { getPostgresDb, schemaPg } from "@/lib/db/postgres";
import { INTEGRATIONS, getIntegration, getRequiredSecrets } from "./integrations";
import { createSecrets, syncSecretsToK8s, syncSecretsToGitea, SecretInput } from "./secrets-service";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

export interface AppConfig {
  // Basic info
  name: string;
  slug: string;
  description?: string;
  
  // Tech stack
  language: "typescript" | "javascript" | "python" | "go";
  framework: "nextjs" | "express" | "fastapi" | "django" | "gin" | "none";
  type: "web" | "api" | "worker" | "cron";
  
  // Repository
  repository: {
    provider: "gitea";
    visibility: "public" | "private";
    templateRepo?: string; // e.g., "templates/nextjs-starter"
    defaultBranch: string;
  };
  
  // Selected integrations
  integrations: string[]; // Integration IDs from INTEGRATIONS
  
  // Secrets (from wizard or auto-provisioned)
  secrets: SecretInput[];
  
  // Deployment
  deployment: {
    environments: ("staging" | "production")[];
    domain?: string;
    stagingDomain?: string;
    autoDeployEnabled: boolean;
    branchFilter?: string;
  };
  
  // Resources
  resources: {
    cpu: { requests: string; limits: string };
    memory: { requests: string; limits: string };
    replicas: { min: number; max: number };
  };
}

export interface ProvisioningResult {
  success: boolean;
  applicationId?: string;
  steps: ProvisioningStep[];
  errors: string[];
}

export interface ProvisioningStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================
// Helper Functions
// ============================================

function getKubectl(): string {
  const kubeconfig = process.env.KUBECONFIG || "~/.kube/config-hetzner";
  return `KUBECONFIG=${kubeconfig} kubectl`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ============================================
// Main Provisioner Class
// ============================================

export class AppProvisioner {
  private steps: ProvisioningStep[] = [];
  private errors: string[] = [];
  private applicationId?: string;
  
  constructor(private config: AppConfig) {}
  
  /**
   * Run the full provisioning workflow
   */
  async provision(): Promise<ProvisioningResult> {
    console.log(`Starting provisioning for app: ${this.config.name}`);
    
    try {
      // Step 1: Create database record
      await this.createDatabaseRecord();
      
      // Step 2: Create Gitea repository
      await this.createGiteaRepository();
      
      // Step 3: Set up integrations
      await this.setupIntegrations();
      
      // Step 4: Store secrets
      await this.storeSecrets();
      
      // Step 5: Create K8s namespace and resources
      await this.createKubernetesResources();
      
      // Step 6: Sync secrets to K8s
      await this.syncSecretsToCluster();
      
      // Step 7: Set up CI/CD
      await this.setupCICD();
      
      return {
        success: this.errors.length === 0,
        applicationId: this.applicationId,
        steps: this.steps,
        errors: this.errors,
      };
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : "Unknown error");
      return {
        success: false,
        applicationId: this.applicationId,
        steps: this.steps,
        errors: this.errors,
      };
    }
  }
  
  // ----------------------------------------
  // Step 1: Create Database Record
  // ----------------------------------------
  private async createDatabaseRecord(): Promise<void> {
    const step = this.startStep("Create database record");
    
    try {
      const db = await getPostgresDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      const [app] = await db
        .insert(schemaPg.applications)
        .values({
          name: this.config.name,
          slug: this.config.slug || slugify(this.config.name),
          description: this.config.description,
          language: this.config.language === "typescript" ? "TypeScript" : 
                    this.config.language === "javascript" ? "JavaScript" :
                    this.config.language === "python" ? "Python" :
                    this.config.language === "go" ? "Go" : this.config.language,
          framework: this.config.framework === "nextjs" ? "Next.js" :
                     this.config.framework === "express" ? "Express" :
                     this.config.framework === "fastapi" ? "FastAPI" :
                     this.config.framework === "django" ? "Django" :
                     this.config.framework === "gin" ? "Gin" : this.config.framework,
          type: this.config.type,
          defaultBranch: this.config.repository.defaultBranch,
          status: "unknown",
          settings: {
            environment: "development",
            domain: this.config.deployment.domain,
            autoDeployEnabled: this.config.deployment.autoDeployEnabled,
            branchFilter: this.config.deployment.branchFilter,
          },
        })
        .returning();
      
      this.applicationId = app.id;
      this.completeStep(step, `Created app with ID: ${app.id}`);
    } catch (error) {
      this.failStep(step, error);
      throw error;
    }
  }
  
  // ----------------------------------------
  // Step 2: Create Gitea Repository
  // ----------------------------------------
  private async createGiteaRepository(): Promise<void> {
    const step = this.startStep("Create Gitea repository");
    
    try {
      const giteaUrl = process.env.GITEA_URL || "https://gitea.gmac.io";
      const giteaToken = process.env.GITEA_TOKEN;
      
      if (!giteaToken) {
        throw new Error("GITEA_TOKEN not configured");
      }
      
      const repoConfig = {
        name: this.config.slug,
        description: this.config.description || `${this.config.name} - Created by Control Panel`,
        private: this.config.repository.visibility === "private",
        auto_init: !this.config.repository.templateRepo, // Don't auto-init if using template
        default_branch: this.config.repository.defaultBranch,
      };
      
      let response: Response;
      
      if (this.config.repository.templateRepo) {
        // Create from template
        const [templateOwner, templateName] = this.config.repository.templateRepo.split("/");
        response = await fetch(
          `${giteaUrl}/api/v1/repos/${templateOwner}/${templateName}/generate`,
          {
            method: "POST",
            headers: {
              "Authorization": `token ${giteaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              owner: process.env.GITEA_USER || "gmac",
              name: this.config.slug,
              description: repoConfig.description,
              private: repoConfig.private,
              git_content: true,
              topics: true,
              default_branch: this.config.repository.defaultBranch,
            }),
          }
        );
      } else {
        // Create empty repo
        response = await fetch(
          `${giteaUrl}/api/v1/user/repos`,
          {
            method: "POST",
            headers: {
              "Authorization": `token ${giteaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(repoConfig),
          }
        );
      }
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create repository: ${error}`);
      }
      
      const repo = await response.json();
      
      // Update app with repository info
      const db = await getPostgresDb();
      if (db && this.applicationId) {
        const { eq } = await import("drizzle-orm");
        await db
          .update(schemaPg.applications)
          .set({
            repositoryUrl: repo.html_url,
            repositoryFullName: repo.full_name,
            giteaRepoId: repo.id,
          })
          .where(eq(schemaPg.applications.id, this.applicationId));
      }
      
      this.completeStep(step, `Created repository: ${repo.full_name}`);
    } catch (error) {
      this.failStep(step, error);
      // Don't throw - repo creation is important but we can continue
      this.errors.push(`Repository creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  // ----------------------------------------
  // Step 3: Set up Integrations
  // ----------------------------------------
  private async setupIntegrations(): Promise<void> {
    const step = this.startStep("Set up integrations");
    
    if (this.config.integrations.length === 0) {
      this.skipStep(step, "No integrations selected");
      return;
    }
    
    try {
      const db = await getPostgresDb();
      if (!db || !this.applicationId) {
        throw new Error("Database or application ID not available");
      }
      
      for (const integrationId of this.config.integrations) {
        const integration = getIntegration(integrationId);
        if (!integration) {
          console.warn(`Unknown integration: ${integrationId}`);
          continue;
        }
        
        // Create integration record
        await db
          .insert(schemaPg.applicationIntegrations)
          .values({
            applicationId: this.applicationId,
            provider: integration.id,
            name: integration.name,
            status: "active",
            config: {
              features: integration.features,
              category: integration.category,
            },
            healthStatus: "unknown",
          });
      }
      
      this.completeStep(step, `Configured ${this.config.integrations.length} integrations`);
    } catch (error) {
      this.failStep(step, error);
      this.errors.push(`Integration setup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  // ----------------------------------------
  // Step 4: Store Secrets
  // ----------------------------------------
  private async storeSecrets(): Promise<void> {
    const step = this.startStep("Store secrets");
    
    if (this.config.secrets.length === 0) {
      this.skipStep(step, "No secrets provided");
      return;
    }
    
    try {
      if (!this.applicationId) {
        throw new Error("Application ID not available");
      }
      
      const results = await createSecrets(
        this.applicationId,
        this.config.secrets,
        "provisioner"
      );
      
      this.completeStep(step, `Stored ${results.length} secrets`);
    } catch (error) {
      this.failStep(step, error);
      this.errors.push(`Secret storage failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  // ----------------------------------------
  // Step 5: Create Kubernetes Resources
  // ----------------------------------------
  private async createKubernetesResources(): Promise<void> {
    const step = this.startStep("Create Kubernetes resources");
    
    try {
      const kubectl = getKubectl();
      const namespace = this.config.slug;
      
      // Create namespace
      const namespaceManifest = {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
          name: namespace,
          labels: {
            "app.kubernetes.io/name": this.config.slug,
            "app.kubernetes.io/managed-by": "control-panel",
            "control-panel/application-id": this.applicationId,
          },
        },
      };
      
      await execAsync(
        `echo '${JSON.stringify(namespaceManifest)}' | ${kubectl} apply -f -`
      );
      
      // Create ResourceQuota for the namespace
      const quotaManifest = {
        apiVersion: "v1",
        kind: "ResourceQuota",
        metadata: {
          name: `${namespace}-quota`,
          namespace: namespace,
        },
        spec: {
          hard: {
            "requests.cpu": "2",
            "requests.memory": "4Gi",
            "limits.cpu": "4",
            "limits.memory": "8Gi",
            pods: "20",
          },
        },
      };
      
      await execAsync(
        `echo '${JSON.stringify(quotaManifest)}' | ${kubectl} apply -f -`
      );
      
      // Create LimitRange for default resource limits
      const limitRangeManifest = {
        apiVersion: "v1",
        kind: "LimitRange",
        metadata: {
          name: `${namespace}-limits`,
          namespace: namespace,
        },
        spec: {
          limits: [
            {
              type: "Container",
              default: {
                cpu: this.config.resources.cpu.limits,
                memory: this.config.resources.memory.limits,
              },
              defaultRequest: {
                cpu: this.config.resources.cpu.requests,
                memory: this.config.resources.memory.requests,
              },
            },
          ],
        },
      };
      
      await execAsync(
        `echo '${JSON.stringify(limitRangeManifest)}' | ${kubectl} apply -f -`
      );
      
      // Create environment status records
      const db = await getPostgresDb();
      if (db && this.applicationId) {
        for (const env of this.config.deployment.environments) {
          const envDomain = env === "production" 
            ? this.config.deployment.domain 
            : this.config.deployment.stagingDomain || `${this.config.slug}-staging.gmac.io`;
          
          await db
            .insert(schemaPg.environmentStatus)
            .values({
              applicationId: this.applicationId,
              environment: env,
              namespace: namespace,
              deploymentName: `${this.config.slug}-${env}`,
              status: "not_deployed",
              url: envDomain ? `https://${envDomain}` : null,
            })
            .onConflictDoNothing();
        }
      }
      
      this.completeStep(step, `Created namespace: ${namespace}`);
    } catch (error) {
      this.failStep(step, error);
      this.errors.push(`K8s resource creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  // ----------------------------------------
  // Step 6: Sync Secrets to Cluster
  // ----------------------------------------
  private async syncSecretsToCluster(): Promise<void> {
    const step = this.startStep("Sync secrets to cluster");
    
    if (this.config.secrets.length === 0) {
      this.skipStep(step, "No secrets to sync");
      return;
    }
    
    try {
      if (!this.applicationId) {
        throw new Error("Application ID not available");
      }
      
      const namespace = this.config.slug;
      
      // Sync to each environment
      for (const env of this.config.deployment.environments) {
        const result = await syncSecretsToK8s(
          this.applicationId,
          namespace,
          env as "staging" | "production"
        );
        
        if (!result.success) {
          console.warn(`Failed to sync secrets to ${env}: ${result.message}`);
        }
      }
      
      this.completeStep(step, `Synced secrets to ${this.config.deployment.environments.join(", ")}`);
    } catch (error) {
      this.failStep(step, error);
      this.errors.push(`Secret sync failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  // ----------------------------------------
  // Step 7: Set up CI/CD
  // ----------------------------------------
  private async setupCICD(): Promise<void> {
    const step = this.startStep("Set up CI/CD");
    
    try {
      const giteaUrl = process.env.GITEA_URL || "https://gitea.gmac.io";
      const giteaToken = process.env.GITEA_TOKEN;
      const giteaUser = process.env.GITEA_USER || "gmac";
      
      if (!giteaToken) {
        throw new Error("GITEA_TOKEN not configured");
      }
      
      const repoFullName = `${giteaUser}/${this.config.slug}`;
      
      // Sync secrets to Gitea for CI/CD
      if (this.applicationId && this.config.secrets.length > 0) {
        await syncSecretsToGitea(this.applicationId, repoFullName);
      }
      
      // Add standard CI secrets
      const ciSecrets = [
        { name: "REGISTRY_URL", value: process.env.HARBOR_URL || "registry.gmac.io" },
        { name: "REGISTRY_USER", value: process.env.HARBOR_USER || "admin" },
        { name: "REGISTRY_PASSWORD", value: process.env.HARBOR_PASSWORD || "" },
        { name: "KUBECONFIG_BASE64", value: process.env.KUBECONFIG_BASE64 || "" },
      ];
      
      for (const secret of ciSecrets) {
        if (!secret.value) continue;
        
        await fetch(
          `${giteaUrl}/api/v1/repos/${repoFullName}/actions/secrets/${secret.name}`,
          {
            method: "PUT",
            headers: {
              "Authorization": `token ${giteaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ data: secret.value }),
          }
        );
      }
      
      // Create webhook for deployment notifications
      await fetch(
        `${giteaUrl}/api/v1/repos/${repoFullName}/hooks`,
        {
          method: "POST",
          headers: {
            "Authorization": `token ${giteaToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "gitea",
            active: true,
            events: ["push", "create", "release"],
            config: {
              url: `${process.env.NEXTAUTH_URL || "https://control.gmac.io"}/api/webhooks/gitea`,
              content_type: "json",
              secret: process.env.WEBHOOK_SECRET || "",
            },
          }),
        }
      );
      
      this.completeStep(step, "CI/CD configured with webhooks");
    } catch (error) {
      this.failStep(step, error);
      this.errors.push(`CI/CD setup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  // ----------------------------------------
  // Step Tracking Helpers
  // ----------------------------------------
  private startStep(name: string): ProvisioningStep {
    const step: ProvisioningStep = {
      name,
      status: "running",
      startedAt: new Date(),
    };
    this.steps.push(step);
    console.log(`[Provisioner] Starting: ${name}`);
    return step;
  }
  
  private completeStep(step: ProvisioningStep, message: string): void {
    step.status = "completed";
    step.message = message;
    step.completedAt = new Date();
    console.log(`[Provisioner] Completed: ${step.name} - ${message}`);
  }
  
  private failStep(step: ProvisioningStep, error: unknown): void {
    step.status = "failed";
    step.message = error instanceof Error ? error.message : "Unknown error";
    step.completedAt = new Date();
    console.error(`[Provisioner] Failed: ${step.name} - ${step.message}`);
  }
  
  private skipStep(step: ProvisioningStep, reason: string): void {
    step.status = "skipped";
    step.message = reason;
    step.completedAt = new Date();
    console.log(`[Provisioner] Skipped: ${step.name} - ${reason}`);
  }
}

// ============================================
// Convenience function
// ============================================

export async function provisionApplication(config: AppConfig): Promise<ProvisioningResult> {
  const provisioner = new AppProvisioner(config);
  return provisioner.provision();
}

// ============================================
// Auto-provisioning helpers
// ============================================

/**
 * Auto-provision Turso database
 */
export async function autoProvisionTurso(appSlug: string): Promise<{
  success: boolean;
  secrets?: { name: string; value: string }[];
  error?: string;
}> {
  try {
    const tursoToken = process.env.TURSO_API_TOKEN;
    const tursoOrg = process.env.TURSO_ORG || "gmac";
    
    if (!tursoToken) {
      return { success: false, error: "TURSO_API_TOKEN not configured" };
    }
    
    // Create database via Turso API
    const response = await fetch(
      `https://api.turso.tech/v1/organizations/${tursoOrg}/databases`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tursoToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: appSlug.replace(/-/g, "_"),
          group: "default",
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to create database: ${error}` };
    }
    
    const db = await response.json();
    
    // Create auth token for the database
    const tokenResponse = await fetch(
      `https://api.turso.tech/v1/organizations/${tursoOrg}/databases/${db.database.Name}/auth/tokens`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tursoToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expiration: "never",
          authorization: "full-access",
        }),
      }
    );
    
    if (!tokenResponse.ok) {
      return { success: false, error: "Failed to create auth token" };
    }
    
    const tokenData = await tokenResponse.json();
    
    return {
      success: true,
      secrets: [
        { 
          name: "TURSO_DATABASE_URL", 
          value: `libsql://${db.database.Hostname}` 
        },
        { 
          name: "TURSO_AUTH_TOKEN", 
          value: tokenData.jwt 
        },
      ],
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// Types are already exported inline above
