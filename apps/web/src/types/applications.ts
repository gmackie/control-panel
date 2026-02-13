export type GitProviderType = 'github' | 'gitea' | 'gitlab';
export type DeployProviderType = 'vercel' | 'kubernetes' | 'railway' | 'flyio';
export type DbProviderType = 'neon' | 'turso' | 'supabase' | 'planetscale';

export interface Application {
  id: string;
  name: string;
  description?: string;
  slug: string;
  productId?: string | null;
  repositoryUrl?: string;
  gitProvider?: GitProviderType;
  deployProvider?: DeployProviderType;
  dbProvider?: DbProviderType;
  apiKeys: ApiKey[];
  secrets: ApplicationSecret[];
  integrations: ApplicationIntegration[];
  settings: ApplicationSettings;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  status: 'active' | 'inactive' | 'archived';
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  hashedKey?: string; // Store only hash in DB
  prefix: string; // First few chars for identification
  permissions: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  isActive: boolean;
}

export interface ApplicationSecret {
  id: string;
  key: string;
  value?: string; // Only returned when explicitly requested
  description?: string;
  category: 'database' | 'api' | 'auth' | 'payment' | 'storage' | 'monitoring' | 'other';
  provider?: string; // e.g., 'stripe', 'supabase', 'clerk'
  isEncrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationIntegration {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  secrets: string[]; // References to ApplicationSecret IDs
  webhooks?: WebhookConfig[];
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
}

export interface ApplicationSettings {
  environment: 'development' | 'staging' | 'production';
  domain?: string;
  corsOrigins?: string[];
  rateLimits?: {
    requests: number;
    window: string; // e.g., '1h', '1d'
  };
  features?: {
    [key: string]: boolean;
  };
}

export interface CreateApplicationRequest {
  name: string;
  description?: string;
  slug?: string;
  environment?: 'development' | 'staging' | 'production';
}

export interface CreateApiKeyRequest {
  name: string;
  permissions?: string[];
  expiresIn?: string; // e.g., '30d', '1y'
}

export interface CreateSecretRequest {
  key: string;
  value: string;
  description?: string;
  category: ApplicationSecret['category'];
  provider?: string;
}

// Integration templates
export const INTEGRATION_TEMPLATES = {
  posthog: {
    name: 'PostHog',
    provider: 'posthog',
    icon: '📊',
    description: 'Product analytics and feature flags',
    requiredSecrets: [
      { key: 'NEXT_PUBLIC_POSTHOG_KEY', category: 'monitoring' as const, description: 'PostHog project API key' },
      { key: 'NEXT_PUBLIC_POSTHOG_HOST', category: 'monitoring' as const, description: 'PostHog host URL (e.g., https://app.posthog.com)' },
    ],
    optionalSecrets: [
      { key: 'POSTHOG_PERSONAL_API_KEY', category: 'monitoring' as const, description: 'Personal API key for server-side operations' },
    ],
    features: ['analytics', 'feature-flags', 'session-recording', 'experiments'],
  },
  neon: {
    name: 'Neon',
    provider: 'neon',
    icon: '🐘',
    description: 'Serverless PostgreSQL database',
    requiredSecrets: [
      { key: 'DATABASE_URL', category: 'database' as const, description: 'PostgreSQL connection string' },
    ],
    optionalSecrets: [
      { key: 'NEON_API_KEY', category: 'database' as const, description: 'Neon API key for management operations' },
      { key: 'DATABASE_URL_UNPOOLED', category: 'database' as const, description: 'Direct connection URL (for migrations)' },
    ],
    features: ['postgres', 'serverless', 'branching', 'auto-scaling'],
  },
  sendgrid: {
    name: 'SendGrid',
    provider: 'sendgrid',
    icon: '📧',
    description: 'Email delivery and marketing platform',
    requiredSecrets: [
      { key: 'SENDGRID_API_KEY', category: 'api' as const, description: 'SendGrid API key' },
    ],
    optionalSecrets: [
      { key: 'SENDGRID_FROM_EMAIL', category: 'api' as const, description: 'Default sender email address' },
      { key: 'SENDGRID_FROM_NAME', category: 'api' as const, description: 'Default sender name' },
    ],
    features: ['transactional-email', 'email-templates', 'analytics', 'webhooks'],
  },
  twilio: {
    name: 'Twilio',
    provider: 'twilio',
    icon: '📱',
    description: 'SMS, voice, and messaging APIs',
    requiredSecrets: [
      { key: 'TWILIO_ACCOUNT_SID', category: 'api' as const, description: 'Twilio Account SID' },
      { key: 'TWILIO_AUTH_TOKEN', category: 'api' as const, description: 'Twilio Auth Token' },
    ],
    optionalSecrets: [
      { key: 'TWILIO_PHONE_NUMBER', category: 'api' as const, description: 'Default Twilio phone number' },
      { key: 'TWILIO_MESSAGING_SERVICE_SID', category: 'api' as const, description: 'Messaging Service SID' },
    ],
    features: ['sms', 'voice', 'whatsapp', 'verify'],
  },
  resend: {
    name: 'Resend',
    provider: 'resend',
    icon: '✉️',
    description: 'Modern email API for developers',
    requiredSecrets: [
      { key: 'RESEND_API_KEY', category: 'api' as const, description: 'Resend API key' },
    ],
    optionalSecrets: [
      { key: 'RESEND_FROM_EMAIL', category: 'api' as const, description: 'Default sender email' },
    ],
    features: ['transactional-email', 'react-email', 'analytics', 'webhooks'],
  },
  upstash: {
    name: 'Upstash',
    provider: 'upstash',
    icon: '🔴',
    description: 'Serverless Redis and Kafka',
    requiredSecrets: [
      { key: 'UPSTASH_REDIS_REST_URL', category: 'database' as const, description: 'Redis REST API URL' },
      { key: 'UPSTASH_REDIS_REST_TOKEN', category: 'database' as const, description: 'Redis REST API token' },
    ],
    optionalSecrets: [
      { key: 'UPSTASH_KAFKA_REST_URL', category: 'database' as const, description: 'Kafka REST API URL' },
      { key: 'UPSTASH_KAFKA_REST_TOKEN', category: 'database' as const, description: 'Kafka REST API token' },
    ],
    features: ['redis', 'rate-limiting', 'caching', 'kafka'],
  },
  stripe: {
    name: 'Stripe',
    provider: 'stripe',
    icon: '💳',
    description: 'Payment processing and billing',
    requiredSecrets: [
      { key: 'STRIPE_SECRET_KEY', category: 'payment' as const, description: 'Secret key for server-side operations' },
      { key: 'STRIPE_WEBHOOK_SECRET', category: 'payment' as const, description: 'Webhook endpoint secret' },
    ],
    optionalSecrets: [
      { key: 'STRIPE_PUBLISHABLE_KEY', category: 'payment' as const, description: 'Publishable key for client-side' },
    ],
    features: ['payments', 'subscriptions', 'invoices', 'webhooks'],
  },
  clerk: {
    name: 'Clerk',
    provider: 'clerk',
    icon: '🔐',
    description: 'Authentication and user management',
    requiredSecrets: [
      { key: 'CLERK_SECRET_KEY', category: 'auth' as const, description: 'Backend API key' },
      { key: 'CLERK_PUBLISHABLE_KEY', category: 'auth' as const, description: 'Frontend publishable key' },
    ],
    optionalSecrets: [
      { key: 'CLERK_WEBHOOK_SECRET', category: 'auth' as const, description: 'Webhook signing secret' },
    ],
    features: ['authentication', 'user-management', 'organizations', 'webhooks'],
  },
  elevenlabs: {
    name: 'ElevenLabs',
    provider: 'elevenlabs',
    icon: '🎙️',
    description: 'AI voice synthesis and text-to-speech',
    requiredSecrets: [
      { key: 'ELEVENLABS_API_KEY', category: 'api' as const, description: 'API key for ElevenLabs' },
    ],
    optionalSecrets: [
      { key: 'ELEVENLABS_VOICE_ID', category: 'api' as const, description: 'Default voice ID' },
    ],
    features: ['text-to-speech', 'voice-synthesis', 'voice-cloning'],
  },
  openrouter: {
    name: 'OpenRouter',
    provider: 'openrouter',
    icon: '🤖',
    description: 'Unified API for multiple LLM providers',
    requiredSecrets: [
      { key: 'OPENROUTER_API_KEY', category: 'api' as const, description: 'API key for OpenRouter' },
    ],
    optionalSecrets: [
      { key: 'OPENROUTER_DEFAULT_MODEL', category: 'api' as const, description: 'Default model to use' },
      { key: 'OPENROUTER_SITE_URL', category: 'api' as const, description: 'Your site URL for rankings' },
      { key: 'OPENROUTER_SITE_NAME', category: 'api' as const, description: 'Your site name' },
    ],
    features: ['llm-access', 'model-routing', 'usage-tracking'],
  },
  turso: {
    name: 'Turso',
    provider: 'turso',
    icon: '🗄️',
    description: 'Edge SQLite database',
    requiredSecrets: [
      { key: 'TURSO_DATABASE_URL', category: 'database' as const, description: 'Database connection URL' },
      { key: 'TURSO_AUTH_TOKEN', category: 'database' as const, description: 'Authentication token' },
    ],
    features: ['edge-database', 'sqlite', 'global-replication'],
  },
  planetscale: {
    name: 'PlanetScale',
    provider: 'planetscale',
    icon: '🌍',
    description: 'Serverless MySQL platform',
    requiredSecrets: [
      { key: 'DATABASE_URL', category: 'database' as const, description: 'MySQL connection string' },
    ],
    optionalSecrets: [
      { key: 'PLANETSCALE_ORG', category: 'database' as const, description: 'Organization name' },
      { key: 'PLANETSCALE_DB', category: 'database' as const, description: 'Database name' },
      { key: 'PLANETSCALE_TOKEN', category: 'database' as const, description: 'API token for migrations' },
    ],
    features: ['mysql', 'serverless', 'branching', 'schema-migrations'],
  },
  supabase: {
    name: 'Supabase',
    provider: 'supabase',
    icon: '⚡',
    description: 'Open source Firebase alternative',
    requiredSecrets: [
      { key: 'SUPABASE_URL', category: 'database' as const, description: 'Project URL' },
      { key: 'SUPABASE_ANON_KEY', category: 'database' as const, description: 'Anonymous/Public key' },
      { key: 'SUPABASE_SERVICE_KEY', category: 'database' as const, description: 'Service role key' },
    ],
    optionalSecrets: [
      { key: 'SUPABASE_JWT_SECRET', category: 'database' as const, description: 'JWT secret for auth' },
    ],
    features: ['postgres', 'realtime', 'storage', 'auth', 'vector-embeddings'],
  },
  sentry: {
    name: 'Sentry',
    provider: 'sentry',
    icon: '🚨',
    description: 'Error tracking and performance monitoring',
    requiredSecrets: [
      { key: 'SENTRY_DSN', category: 'monitoring' as const, description: 'Data Source Name' },
    ],
    optionalSecrets: [
      { key: 'SENTRY_AUTH_TOKEN', category: 'monitoring' as const, description: 'Auth token for source maps' },
      { key: 'SENTRY_ORG', category: 'monitoring' as const, description: 'Organization slug' },
      { key: 'SENTRY_PROJECT', category: 'monitoring' as const, description: 'Project slug' },
    ],
    features: ['error-tracking', 'performance', 'release-tracking', 'alerts'],
  },
  aws: {
    name: 'AWS',
    provider: 'aws',
    icon: '☁️',
    description: 'Amazon Web Services',
    requiredSecrets: [
      { key: 'AWS_ACCESS_KEY_ID', category: 'storage' as const, description: 'Access key ID' },
      { key: 'AWS_SECRET_ACCESS_KEY', category: 'storage' as const, description: 'Secret access key' },
      { key: 'AWS_REGION', category: 'storage' as const, description: 'Default region' },
    ],
    optionalSecrets: [
      { key: 'AWS_S3_BUCKET', category: 'storage' as const, description: 'Default S3 bucket' },
      { key: 'AWS_SESSION_TOKEN', category: 'storage' as const, description: 'Session token for temporary credentials' },
    ],
    features: ['s3', 'lambda', 'dynamodb', 'ses', 'sqs', 'sns'],
  },
};
