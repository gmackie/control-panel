/**
 * Application Provisioning Module
 * 
 * Provides a unified interface for:
 * - Creating new applications with full infrastructure
 * - Managing integrations and their configurations
 * - Handling secrets with encryption and K8s sync
 * - Namespace management per application
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

// Secrets service
export {
  createSecret,
  getSecrets,
  getSecretWithValue,
  updateSecret,
  deleteSecret,
  createSecrets,
  getSecretsForEnvironment,
  syncSecretsToK8s,
  deleteK8sSecret,
  checkK8sSecretSync,
  syncSecretsToGitea,
  type SecretInput,
  type SecretOutput,
  type SecretWithValue,
} from "./secrets-service";

// App provisioner
export {
  AppProvisioner,
  provisionApplication,
  autoProvisionTurso,
  type AppConfig,
  type ProvisioningResult,
  type ProvisioningStep,
} from "./app-provisioner";
