/**
 * Application Provisioning Module
 * 
 * Provides a unified interface for:
 * - Creating new applications with full infrastructure
 * - Managing integrations and their configurations
 * - Handling secrets with encryption and K8s sync
 * - Namespace management per application
 * 
 * Note: secrets-service and app-provisioner have been removed
 * during Neon migration. These exports are stubs for now.
 */

// Integration definitions
export {
  INTEGRATIONS,
  getIntegration,
  getIntegrationsByCategory,
  getRequiredSecrets,
  getAutoProvisionableSecrets,
  validateSecretValue,
  getDependencies,
  generateEnvExample,
  type IntegrationDefinition,
  type SecretDefinition,
  type IntegrationCategory,
  type SecretCategory,
} from "./integrations";

// Stub types for secrets (service removed during migration)
export interface SecretInput {
  name: string;
  value: string;
  description?: string;
  environment?: string;
  integration?: string;
}

export interface SecretOutput {
  id: string;
  name: string;
  environment: string;
  integration?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretWithValue extends SecretOutput {
  value: string;
}

// Stub types for provisioning (service removed during migration)
export interface AppConfig {
  name: string;
  slug: string;
  description?: string;
  language?: string;
  framework?: string;
  type?: string;
  integrations?: string[];
  secrets?: SecretInput[];
  repository?: {
    provider: string;
    visibility: string;
    templateRepo?: string;
    defaultBranch: string;
  };
  deployment?: {
    environments: ("staging" | "production")[];
    domain?: string;
    stagingDomain?: string;
    autoDeployEnabled?: boolean;
    branchFilter?: string;
  };
  resources?: {
    cpu: { requests: string; limits: string };
    memory: { requests: string; limits: string };
    replicas: { min: number; max: number };
  };
}

export interface ProvisioningStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
}

export interface ProvisioningResult {
  success: boolean;
  applicationId?: string;
  steps: ProvisioningStep[];
  error?: string;
  errors?: string[];
}

// Stub functions - throw not implemented for now
export async function createSecret(_appId: string, _input: SecretInput): Promise<SecretOutput> {
  throw new Error('Secrets service not implemented - removed during Neon migration');
}

export async function getSecrets(_appId: string): Promise<SecretOutput[]> {
  return [];
}

export async function getSecretWithValue(_appId: string, _secretId: string): Promise<SecretWithValue | null> {
  return null;
}

export async function updateSecret(_appId: string, _secretId: string, _value: string): Promise<SecretOutput> {
  throw new Error('Secrets service not implemented - removed during Neon migration');
}

export async function deleteSecret(_appId: string, _secretId: string): Promise<void> {
  throw new Error('Secrets service not implemented - removed during Neon migration');
}

export async function createSecrets(_appId: string, _inputs: SecretInput[]): Promise<SecretOutput[]> {
  throw new Error('Secrets service not implemented - removed during Neon migration');
}

export async function getSecretsForEnvironment(_appId: string, _environment: string): Promise<SecretOutput[]> {
  return [];
}

export async function syncSecretsToK8s(_appId: string, _environment: string): Promise<{ success: boolean }> {
  return { success: false };
}

export async function deleteK8sSecret(_appId: string, _environment: string): Promise<void> {
  // No-op
}

export async function checkK8sSecretSync(_appId: string, _environment: string): Promise<boolean> {
  return false;
}

export async function syncSecretsToGitea(_appId: string): Promise<{ success: boolean }> {
  return { success: false };
}

// Stub provisioner class
export class AppProvisioner {
  async provision(_config: AppConfig): Promise<ProvisioningResult> {
    return {
      success: false,
      steps: [],
      error: 'AppProvisioner not implemented - removed during Neon migration',
    };
  }
}

export async function provisionApplication(_config: AppConfig): Promise<ProvisioningResult> {
  return {
    success: false,
    steps: [],
    error: 'provisionApplication not implemented - removed during Neon migration',
  };
}

export async function autoProvisionTurso(_appId: string): Promise<{ success: boolean }> {
  return { success: false };
}
