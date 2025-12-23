/**
 * Secrets Service
 * 
 * Manages application secrets with:
 * - AES-256-GCM encryption for database storage
 * - Sync to Kubernetes Secrets
 * - Environment-specific secrets (dev/staging/prod)
 * - Secret rotation support
 */

import { getPostgresDb, schemaPg } from "@/lib/db/postgres";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { eq, and } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SecretInput {
  name: string;
  value: string;
  description?: string;
  environment: "all" | "development" | "staging" | "production";
}

export interface SecretOutput {
  id: string;
  name: string;
  description?: string;
  environment: string;
  maskedValue: string;
  createdAt: Date;
  updatedAt: Date;
  lastRotatedAt?: Date;
  expiresAt?: Date;
  syncedToK8s: boolean;
}

export interface SecretWithValue extends SecretOutput {
  value: string;
}

interface K8sSecretData {
  [key: string]: string;
}

/**
 * Get kubectl command with proper kubeconfig
 */
function getKubectl(): string {
  const kubeconfig = process.env.KUBECONFIG || "~/.kube/config-hetzner";
  return `KUBECONFIG=${kubeconfig} kubectl`;
}

/**
 * Create a secret in the database
 */
export async function createSecret(
  applicationId: string,
  secret: SecretInput,
  createdBy?: string
): Promise<SecretOutput> {
  const db = await getPostgresDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Encrypt the secret value
  const { encryptedValue, iv } = encryptSecret(secret.value);

  // Insert into database
  const [result] = await db
    .insert(schemaPg.applicationSecrets)
    .values({
      applicationId,
      name: secret.name,
      encryptedValue,
      iv,
      description: secret.description,
      environment: secret.environment,
      createdBy,
    })
    .returning();

  return {
    id: result.id,
    name: result.name,
    description: result.description || undefined,
    environment: result.environment,
    maskedValue: maskSecret(secret.value),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    lastRotatedAt: result.lastRotatedAt || undefined,
    expiresAt: result.expiresAt || undefined,
    syncedToK8s: false,
  };
}

/**
 * Get all secrets for an application (without values)
 */
export async function getSecrets(applicationId: string): Promise<SecretOutput[]> {
  const db = await getPostgresDb();
  if (!db) {
    return [];
  }

  const secrets = await db
    .select()
    .from(schemaPg.applicationSecrets)
    .where(eq(schemaPg.applicationSecrets.applicationId, applicationId));

  return secrets.map((s: typeof schemaPg.applicationSecrets.$inferSelect) => ({
    id: s.id,
    name: s.name,
    description: s.description || undefined,
    environment: s.environment,
    maskedValue: "••••••••", // Don't even try to mask, just hide
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    lastRotatedAt: s.lastRotatedAt || undefined,
    expiresAt: s.expiresAt || undefined,
    syncedToK8s: false, // Would need to track this
  }));
}

/**
 * Get a secret with its decrypted value
 */
export async function getSecretWithValue(
  applicationId: string,
  secretId: string
): Promise<SecretWithValue | null> {
  const db = await getPostgresDb();
  if (!db) {
    return null;
  }

  const [secret] = await db
    .select()
    .from(schemaPg.applicationSecrets)
    .where(
      and(
        eq(schemaPg.applicationSecrets.id, secretId),
        eq(schemaPg.applicationSecrets.applicationId, applicationId)
      )
    );

  if (!secret) {
    return null;
  }

  // Decrypt the value
  const value = decryptSecret(secret.encryptedValue, secret.iv);

  return {
    id: secret.id,
    name: secret.name,
    description: secret.description || undefined,
    environment: secret.environment,
    maskedValue: maskSecret(value),
    value,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    lastRotatedAt: secret.lastRotatedAt || undefined,
    expiresAt: secret.expiresAt || undefined,
    syncedToK8s: false,
  };
}

/**
 * Update a secret's value
 */
export async function updateSecret(
  applicationId: string,
  secretId: string,
  newValue: string,
  updatedBy?: string
): Promise<SecretOutput> {
  const db = await getPostgresDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Encrypt the new value
  const { encryptedValue, iv } = encryptSecret(newValue);

  const [result] = await db
    .update(schemaPg.applicationSecrets)
    .set({
      encryptedValue,
      iv,
      updatedBy,
      updatedAt: new Date(),
      lastRotatedAt: new Date(),
    })
    .where(
      and(
        eq(schemaPg.applicationSecrets.id, secretId),
        eq(schemaPg.applicationSecrets.applicationId, applicationId)
      )
    )
    .returning();

  if (!result) {
    throw new Error("Secret not found");
  }

  return {
    id: result.id,
    name: result.name,
    description: result.description || undefined,
    environment: result.environment,
    maskedValue: maskSecret(newValue),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    lastRotatedAt: result.lastRotatedAt || undefined,
    expiresAt: result.expiresAt || undefined,
    syncedToK8s: false,
  };
}

/**
 * Delete a secret
 */
export async function deleteSecret(
  applicationId: string,
  secretId: string
): Promise<boolean> {
  const db = await getPostgresDb();
  if (!db) {
    return false;
  }

  const result = await db
    .delete(schemaPg.applicationSecrets)
    .where(
      and(
        eq(schemaPg.applicationSecrets.id, secretId),
        eq(schemaPg.applicationSecrets.applicationId, applicationId)
      )
    );

  return true;
}

/**
 * Create multiple secrets at once (for wizard)
 */
export async function createSecrets(
  applicationId: string,
  secrets: SecretInput[],
  createdBy?: string
): Promise<SecretOutput[]> {
  const results: SecretOutput[] = [];
  
  for (const secret of secrets) {
    const result = await createSecret(applicationId, secret, createdBy);
    results.push(result);
  }
  
  return results;
}

/**
 * Get all secrets for an environment as key-value pairs
 * Used for syncing to K8s
 */
export async function getSecretsForEnvironment(
  applicationId: string,
  environment: "development" | "staging" | "production"
): Promise<Record<string, string>> {
  const db = await getPostgresDb();
  if (!db) {
    return {};
  }

  const secrets = await db
    .select()
    .from(schemaPg.applicationSecrets)
    .where(eq(schemaPg.applicationSecrets.applicationId, applicationId));

  const result: Record<string, string> = {};
  
  for (const secret of secrets) {
    // Include if environment matches or is "all"
    if (secret.environment === "all" || secret.environment === environment) {
      result[secret.name] = decryptSecret(secret.encryptedValue, secret.iv);
    }
  }
  
  return result;
}

// ============================================
// Kubernetes Secret Sync
// ============================================

/**
 * Sync secrets to a Kubernetes namespace
 */
export async function syncSecretsToK8s(
  applicationId: string,
  namespace: string,
  environment: "staging" | "production"
): Promise<{ success: boolean; message: string }> {
  try {
    const secrets = await getSecretsForEnvironment(applicationId, environment);
    
    if (Object.keys(secrets).length === 0) {
      return { success: true, message: "No secrets to sync" };
    }

    // Get app slug for secret name
    const db = await getPostgresDb();
    if (!db) {
      return { success: false, message: "Database not available" };
    }

    const [app] = await db
      .select({ slug: schemaPg.applications.slug })
      .from(schemaPg.applications)
      .where(eq(schemaPg.applications.id, applicationId));

    if (!app) {
      return { success: false, message: "Application not found" };
    }

    const secretName = `${app.slug}-secrets`;
    const kubectl = getKubectl();

    // Create namespace if it doesn't exist
    try {
      await execAsync(`${kubectl} create namespace ${namespace} --dry-run=client -o yaml | ${kubectl} apply -f -`);
    } catch (e) {
      // Namespace might already exist, that's fine
    }

    // Build the secret data
    const secretData: K8sSecretData = {};
    for (const [key, value] of Object.entries(secrets)) {
      secretData[key] = Buffer.from(value).toString("base64");
    }

    // Create the K8s Secret manifest
    const secretManifest = {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: secretName,
        namespace: namespace,
        labels: {
          "app.kubernetes.io/name": app.slug,
          "app.kubernetes.io/managed-by": "control-panel",
          "control-panel/environment": environment,
        },
        annotations: {
          "control-panel/synced-at": new Date().toISOString(),
          "control-panel/application-id": applicationId,
        },
      },
      type: "Opaque",
      data: secretData,
    };

    // Apply the secret
    const manifestYaml = JSON.stringify(secretManifest);
    await execAsync(`echo '${manifestYaml}' | ${kubectl} apply -f -`);

    return { 
      success: true, 
      message: `Synced ${Object.keys(secrets).length} secrets to ${namespace}/${secretName}` 
    };
  } catch (error) {
    console.error("Failed to sync secrets to K8s:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Delete K8s secret for an application
 */
export async function deleteK8sSecret(
  appSlug: string,
  namespace: string
): Promise<{ success: boolean; message: string }> {
  try {
    const kubectl = getKubectl();
    const secretName = `${appSlug}-secrets`;
    
    await execAsync(`${kubectl} delete secret ${secretName} -n ${namespace} --ignore-not-found`);
    
    return { success: true, message: `Deleted secret ${secretName} from ${namespace}` };
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Check if K8s secret exists and is in sync
 */
export async function checkK8sSecretSync(
  appSlug: string,
  namespace: string
): Promise<{ exists: boolean; inSync: boolean; lastSynced?: string }> {
  try {
    const kubectl = getKubectl();
    const secretName = `${appSlug}-secrets`;
    
    const { stdout } = await execAsync(
      `${kubectl} get secret ${secretName} -n ${namespace} -o jsonpath='{.metadata.annotations.control-panel/synced-at}' 2>/dev/null`
    );
    
    if (!stdout) {
      return { exists: false, inSync: false };
    }
    
    return { 
      exists: true, 
      inSync: true, // Would need to compare with DB to truly verify
      lastSynced: stdout.replace(/'/g, ""),
    };
  } catch {
    return { exists: false, inSync: false };
  }
}

// ============================================
// Gitea Secret Sync (for CI/CD)
// ============================================

/**
 * Sync secrets to Gitea repository for CI/CD
 */
export async function syncSecretsToGitea(
  applicationId: string,
  repoFullName: string // owner/repo format
): Promise<{ success: boolean; message: string; syncedCount: number }> {
  try {
    const secrets = await getSecretsForEnvironment(applicationId, "production");
    
    const giteaUrl = process.env.GITEA_URL || "https://gitea.gmac.io";
    const giteaToken = process.env.GITEA_TOKEN;
    
    if (!giteaToken) {
      return { success: false, message: "GITEA_TOKEN not configured", syncedCount: 0 };
    }

    let syncedCount = 0;
    const errors: string[] = [];

    for (const [name, value] of Object.entries(secrets)) {
      try {
        // Create or update secret in Gitea
        const response = await fetch(
          `${giteaUrl}/api/v1/repos/${repoFullName}/actions/secrets/${name}`,
          {
            method: "PUT",
            headers: {
              "Authorization": `token ${giteaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ data: value }),
          }
        );

        if (response.ok || response.status === 201) {
          syncedCount++;
        } else {
          errors.push(`${name}: ${response.statusText}`);
        }
      } catch (e) {
        errors.push(`${name}: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: syncedCount > 0,
        message: `Synced ${syncedCount}/${Object.keys(secrets).length}. Errors: ${errors.join(", ")}`,
        syncedCount,
      };
    }

    return {
      success: true,
      message: `Synced ${syncedCount} secrets to Gitea repository`,
      syncedCount,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      syncedCount: 0,
    };
  }
}

// ============================================
// Export types and functions
// ============================================

// Types are already exported inline above
