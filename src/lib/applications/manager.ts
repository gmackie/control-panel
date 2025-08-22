import { randomBytes } from 'crypto';
import { 
  Application, 
  ApiKey, 
  ApplicationSecret, 
  CreateApplicationRequest,
  CreateApiKeyRequest,
  CreateSecretRequest 
} from '@/types/applications';

// In-memory storage for demo purposes
const applications: Map<string, Application> = new Map();
const apiKeys: Map<string, ApiKey> = new Map();
const secrets: Map<string, ApplicationSecret> = new Map();

// Helper functions
function generateId(): string {
  return randomBytes(16).toString('hex');
}

function generateApiKey(): { key: string; prefix: string; hashedKey: string } {
  const key = `sk_live_${randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12);
  // In production, use bcrypt or argon2
  const hashedKey = Buffer.from(key).toString('base64');
  return { key, prefix, hashedKey };
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Application management
export async function createApplication(
  data: CreateApplicationRequest,
  ownerId: string
): Promise<Application> {
  const id = generateId();
  const slug = data.slug || generateSlug(data.name);
  
  const application: Application = {
    id,
    name: data.name,
    description: data.description,
    slug,
    apiKeys: [],
    secrets: [],
    integrations: [],
    settings: {
      environment: data.environment || 'development',
      features: {},
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerId,
    status: 'active',
  };
  
  applications.set(id, application);
  return application;
}

export async function getApplication(id: string): Promise<Application | null> {
  return applications.get(id) || null;
}

export async function getApplicationBySlug(slug: string): Promise<Application | null> {
  for (const app of applications.values()) {
    if (app.slug === slug) return app;
  }
  return null;
}

export async function getApplications(ownerId: string): Promise<Application[]> {
  return Array.from(applications.values()).filter(app => app.ownerId === ownerId);
}

export async function updateApplication(
  id: string,
  updates: Partial<Application>
): Promise<Application | null> {
  const app = applications.get(id);
  if (!app) return null;
  
  const updated = {
    ...app,
    ...updates,
    id: app.id, // Prevent ID changes
    updatedAt: new Date().toISOString(),
  };
  
  applications.set(id, updated);
  return updated;
}

export async function deleteApplication(id: string): Promise<boolean> {
  const app = applications.get(id);
  if (!app) return false;
  
  // Delete associated API keys and secrets
  app.apiKeys.forEach(key => apiKeys.delete(key.id));
  app.secrets.forEach(secret => secrets.delete(secret.id));
  
  return applications.delete(id);
}

// API Key management
export async function createApiKey(
  applicationId: string,
  data: CreateApiKeyRequest
): Promise<ApiKey | null> {
  const app = applications.get(applicationId);
  if (!app) return null;
  
  const id = generateId();
  const { key, prefix, hashedKey } = generateApiKey();
  
  const apiKey: ApiKey = {
    id,
    name: data.name,
    key, // Only return on creation
    hashedKey,
    prefix,
    permissions: data.permissions || ['read'],
    expiresAt: data.expiresIn ? calculateExpiry(data.expiresIn) : undefined,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  
  apiKeys.set(id, apiKey);
  app.apiKeys.push(apiKey);
  applications.set(applicationId, app);
  
  return apiKey;
}

export async function getApiKeys(applicationId: string): Promise<ApiKey[]> {
  const app = applications.get(applicationId);
  if (!app) return [];
  
  // Return keys without the actual key value
  return app.apiKeys.map(key => ({
    ...key,
    key: undefined as any,
  }));
}

export async function revokeApiKey(applicationId: string, keyId: string): Promise<boolean> {
  const app = applications.get(applicationId);
  if (!app) return false;
  
  const keyIndex = app.apiKeys.findIndex(k => k.id === keyId);
  if (keyIndex === -1) return false;
  
  app.apiKeys[keyIndex].isActive = false;
  applications.set(applicationId, app);
  
  return true;
}

export async function validateApiKey(key: string): Promise<{ valid: boolean; applicationId?: string }> {
  // In production, hash the key and look up by hash
  const hashedKey = Buffer.from(key).toString('base64');
  
  for (const app of applications.values()) {
    for (const apiKey of app.apiKeys) {
      if (apiKey.hashedKey === hashedKey && apiKey.isActive) {
        // Check expiry
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
          return { valid: false };
        }
        
        // Update last used
        apiKey.lastUsedAt = new Date().toISOString();
        
        return { valid: true, applicationId: app.id };
      }
    }
  }
  
  return { valid: false };
}

// Secret management
export async function createSecret(
  applicationId: string,
  data: CreateSecretRequest
): Promise<ApplicationSecret | null> {
  const app = applications.get(applicationId);
  if (!app) return null;
  
  const id = generateId();
  
  const secret: ApplicationSecret = {
    id,
    key: data.key,
    value: encryptValue(data.value), // Encrypt before storing
    description: data.description,
    category: data.category,
    provider: data.provider,
    isEncrypted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  secrets.set(id, secret);
  app.secrets.push(secret);
  applications.set(applicationId, app);
  
  // Return without value for security
  return { ...secret, value: undefined };
}

export async function getSecrets(applicationId: string): Promise<ApplicationSecret[]> {
  const app = applications.get(applicationId);
  if (!app) return [];
  
  // Return secrets without values
  return app.secrets.map(secret => ({
    ...secret,
    value: undefined,
  }));
}

export async function getSecret(
  applicationId: string,
  secretId: string,
  includeValue = false
): Promise<ApplicationSecret | null> {
  const app = applications.get(applicationId);
  if (!app) return null;
  
  const secret = app.secrets.find(s => s.id === secretId);
  if (!secret) return null;
  
  if (includeValue) {
    return {
      ...secret,
      value: decryptValue(secret.value!),
    };
  }
  
  return { ...secret, value: undefined };
}

export async function updateSecret(
  applicationId: string,
  secretId: string,
  updates: Partial<CreateSecretRequest>
): Promise<ApplicationSecret | null> {
  const app = applications.get(applicationId);
  if (!app) return null;
  
  const secretIndex = app.secrets.findIndex(s => s.id === secretId);
  if (secretIndex === -1) return null;
  
  const secret = app.secrets[secretIndex];
  const updated: ApplicationSecret = {
    ...secret,
    ...updates,
    value: updates.value ? encryptValue(updates.value) : secret.value,
    updatedAt: new Date().toISOString(),
  };
  
  app.secrets[secretIndex] = updated;
  secrets.set(secretId, updated);
  applications.set(applicationId, app);
  
  return { ...updated, value: undefined };
}

export async function deleteSecret(
  applicationId: string,
  secretId: string
): Promise<boolean> {
  const app = applications.get(applicationId);
  if (!app) return false;
  
  const secretIndex = app.secrets.findIndex(s => s.id === secretId);
  if (secretIndex === -1) return false;
  
  app.secrets.splice(secretIndex, 1);
  applications.set(applicationId, app);
  secrets.delete(secretId);
  
  return true;
}

// Helper functions
function calculateExpiry(duration: string): string {
  const now = new Date();
  const match = duration.match(/^(\d+)([dmy])$/);
  
  if (!match) {
    throw new Error('Invalid duration format');
  }
  
  const [, value, unit] = match;
  const num = parseInt(value, 10);
  
  switch (unit) {
    case 'd':
      now.setDate(now.getDate() + num);
      break;
    case 'm':
      now.setMonth(now.getMonth() + num);
      break;
    case 'y':
      now.setFullYear(now.getFullYear() + num);
      break;
  }
  
  return now.toISOString();
}

// Simple encryption for demo - use proper encryption in production
function encryptValue(value: string): string {
  return Buffer.from(value).toString('base64');
}

function decryptValue(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// Initialize with sample data
const sampleApp: Application = {
  id: '1',
  name: 'My SaaS App',
  description: 'Production application with multiple integrations',
  slug: 'my-saas-app',
  apiKeys: [],
  secrets: [],
  integrations: [],
  settings: {
    environment: 'production',
    domain: 'myapp.gmac.io',
    corsOrigins: ['https://myapp.gmac.io', 'http://localhost:3000'],
    rateLimits: {
      requests: 10000,
      window: '1h',
    },
    features: {
      analytics: true,
      webhooks: true,
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ownerId: 'gmackie',
  status: 'active',
};

applications.set(sampleApp.id, sampleApp);