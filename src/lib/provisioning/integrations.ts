/**
 * Unified Integration Definitions
 * 
 * Single source of truth for all integration configurations.
 * Each integration defines:
 * - Required and optional secrets
 * - Auto-provisioning capabilities
 * - Health check endpoints
 * - Dependencies and setup files
 * - Environment-specific configurations
 */

export type IntegrationCategory = 
  | 'auth'
  | 'database'
  | 'payments'
  | 'monitoring'
  | 'ai'
  | 'storage'
  | 'email'
  | 'analytics';

export type SecretCategory = 
  | 'api'
  | 'auth'
  | 'database'
  | 'payment'
  | 'storage'
  | 'monitoring'
  | 'other';

export interface SecretDefinition {
  /** Environment variable name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping */
  category: SecretCategory;
  /** Is this secret required for the integration to work? */
  required: boolean;
  /** Should this be exposed to the client/browser? */
  isPublic?: boolean;
  /** Example value format (for validation hints) */
  example?: string;
  /** Validation regex pattern */
  pattern?: string;
  /** Can this be auto-provisioned? */
  autoProvision?: boolean;
}

export interface IntegrationDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Icon (emoji or icon name) */
  icon: string;
  /** Category for grouping */
  category: IntegrationCategory;
  /** Short description */
  description: string;
  /** Detailed description for docs */
  longDescription?: string;
  /** Documentation URL */
  docsUrl?: string;
  /** All secrets for this integration */
  secrets: SecretDefinition[];
  /** Features this integration enables */
  features: string[];
  /** NPM packages to install */
  dependencies: string[];
  /** Dev dependencies */
  devDependencies?: string[];
  /** Setup files to generate */
  setupFiles?: {
    path: string;
    template: string;
  }[];
  /** Health check configuration */
  healthCheck?: {
    /** Type of health check */
    type: 'http' | 'tcp' | 'custom';
    /** Endpoint for HTTP checks */
    endpoint?: string;
    /** Expected response code */
    expectedStatus?: number;
    /** Timeout in ms */
    timeout?: number;
  };
  /** Can we auto-provision this service? */
  autoProvision?: {
    /** Is auto-provisioning supported? */
    supported: boolean;
    /** Provider for auto-provisioning (e.g., 'turso', 'clerk-dev') */
    provider?: string;
    /** Description of what gets provisioned */
    description?: string;
  };
  /** Per-environment configuration differences */
  environments?: {
    development?: Partial<IntegrationDefinition>;
    staging?: Partial<IntegrationDefinition>;
    production?: Partial<IntegrationDefinition>;
  };
}

/**
 * All available integrations
 */
export const INTEGRATIONS: Record<string, IntegrationDefinition> = {
  // ============================================
  // Authentication
  // ============================================
  clerk: {
    id: 'clerk',
    name: 'Clerk',
    icon: 'shield',
    category: 'auth',
    description: 'Authentication and user management',
    longDescription: 'Complete user management with social login, MFA, and organization support',
    docsUrl: 'https://clerk.com/docs',
    secrets: [
      {
        name: 'CLERK_SECRET_KEY',
        description: 'Backend API key for server-side operations',
        category: 'auth',
        required: true,
        example: 'sk_test_...',
        pattern: '^sk_(test|live)_[A-Za-z0-9]+$',
      },
      {
        name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        description: 'Frontend publishable key',
        category: 'auth',
        required: true,
        isPublic: true,
        example: 'pk_test_...',
        pattern: '^pk_(test|live)_[A-Za-z0-9]+$',
      },
      {
        name: 'CLERK_WEBHOOK_SECRET',
        description: 'Webhook signing secret for event verification',
        category: 'auth',
        required: false,
        example: 'whsec_...',
      },
    ],
    features: ['authentication', 'user-management', 'organizations', 'mfa', 'social-login', 'webhooks'],
    dependencies: ['@clerk/nextjs'],
    healthCheck: {
      type: 'http',
      endpoint: 'https://api.clerk.dev/v1/health',
      expectedStatus: 200,
      timeout: 5000,
    },
    autoProvision: {
      supported: true,
      provider: 'clerk-dev',
      description: 'Creates a development Clerk application',
    },
  },

  // ============================================
  // Databases
  // ============================================
  turso: {
    id: 'turso',
    name: 'Turso',
    icon: 'database',
    category: 'database',
    description: 'Edge SQLite database with global replication',
    docsUrl: 'https://docs.turso.tech',
    secrets: [
      {
        name: 'TURSO_DATABASE_URL',
        description: 'Database connection URL (libsql://)',
        category: 'database',
        required: true,
        example: 'libsql://your-db.turso.io',
        pattern: '^libsql://[a-zA-Z0-9-]+\\.turso\\.io$',
        autoProvision: true,
      },
      {
        name: 'TURSO_AUTH_TOKEN',
        description: 'Authentication token for database access',
        category: 'database',
        required: true,
        autoProvision: true,
      },
    ],
    features: ['sqlite', 'edge-database', 'global-replication', 'branching'],
    dependencies: ['@libsql/client', 'drizzle-orm'],
    devDependencies: ['drizzle-kit'],
    autoProvision: {
      supported: true,
      provider: 'turso',
      description: 'Creates a new Turso database with auth token',
    },
  },

  supabase: {
    id: 'supabase',
    name: 'Supabase',
    icon: 'zap',
    category: 'database',
    description: 'Open source Firebase alternative with Postgres',
    docsUrl: 'https://supabase.com/docs',
    secrets: [
      {
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        description: 'Supabase project URL',
        category: 'database',
        required: true,
        isPublic: true,
        example: 'https://xxx.supabase.co',
      },
      {
        name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        description: 'Anonymous/public API key',
        category: 'database',
        required: true,
        isPublic: true,
      },
      {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        description: 'Service role key for admin operations',
        category: 'database',
        required: true,
      },
      {
        name: 'SUPABASE_JWT_SECRET',
        description: 'JWT secret for token verification',
        category: 'database',
        required: false,
      },
    ],
    features: ['postgres', 'realtime', 'storage', 'auth', 'edge-functions', 'vector'],
    dependencies: ['@supabase/supabase-js', '@supabase/ssr'],
  },

  postgres: {
    id: 'postgres',
    name: 'PostgreSQL',
    icon: 'database',
    category: 'database',
    description: 'Self-managed PostgreSQL database',
    secrets: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL connection string',
        category: 'database',
        required: true,
        example: 'postgresql://user:pass@host:5432/db',
        pattern: '^postgresql://.*$',
      },
    ],
    features: ['postgres', 'sql', 'transactions', 'json'],
    dependencies: ['pg', 'drizzle-orm'],
    devDependencies: ['drizzle-kit', '@types/pg'],
  },

  // ============================================
  // Payments
  // ============================================
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    icon: 'credit-card',
    category: 'payments',
    description: 'Payment processing and billing',
    docsUrl: 'https://stripe.com/docs',
    secrets: [
      {
        name: 'STRIPE_SECRET_KEY',
        description: 'Secret key for server-side operations',
        category: 'payment',
        required: true,
        example: 'sk_test_...',
        pattern: '^sk_(test|live)_[A-Za-z0-9]+$',
      },
      {
        name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        description: 'Publishable key for client-side',
        category: 'payment',
        required: true,
        isPublic: true,
        example: 'pk_test_...',
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        description: 'Webhook endpoint secret',
        category: 'payment',
        required: false,
        example: 'whsec_...',
      },
    ],
    features: ['payments', 'subscriptions', 'invoices', 'checkout', 'webhooks'],
    dependencies: ['stripe', '@stripe/stripe-js'],
    healthCheck: {
      type: 'http',
      endpoint: 'https://api.stripe.com/v1',
      expectedStatus: 401, // Returns 401 without auth, but confirms API is up
      timeout: 5000,
    },
  },

  // ============================================
  // AI/ML
  // ============================================
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: 'bot',
    category: 'ai',
    description: 'Unified API for multiple LLM providers',
    docsUrl: 'https://openrouter.ai/docs',
    secrets: [
      {
        name: 'OPENROUTER_API_KEY',
        description: 'API key for OpenRouter',
        category: 'api',
        required: true,
      },
      {
        name: 'OPENROUTER_DEFAULT_MODEL',
        description: 'Default model to use (e.g., anthropic/claude-3-opus)',
        category: 'api',
        required: false,
        example: 'anthropic/claude-3.5-sonnet',
      },
    ],
    features: ['llm', 'chat', 'completion', 'embeddings', 'model-routing'],
    dependencies: ['openai'], // Uses OpenAI-compatible API
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    icon: 'brain',
    category: 'ai',
    description: 'GPT models and DALL-E',
    docsUrl: 'https://platform.openai.com/docs',
    secrets: [
      {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key',
        category: 'api',
        required: true,
        pattern: '^sk-[A-Za-z0-9]+$',
      },
      {
        name: 'OPENAI_ORG_ID',
        description: 'Organization ID (optional)',
        category: 'api',
        required: false,
      },
    ],
    features: ['gpt', 'chat', 'embeddings', 'dall-e', 'whisper', 'tts'],
    dependencies: ['openai'],
  },

  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    icon: 'mic',
    category: 'ai',
    description: 'AI voice synthesis and text-to-speech',
    docsUrl: 'https://elevenlabs.io/docs',
    secrets: [
      {
        name: 'ELEVENLABS_API_KEY',
        description: 'API key for ElevenLabs',
        category: 'api',
        required: true,
      },
      {
        name: 'ELEVENLABS_VOICE_ID',
        description: 'Default voice ID',
        category: 'api',
        required: false,
      },
    ],
    features: ['text-to-speech', 'voice-synthesis', 'voice-cloning'],
    dependencies: ['elevenlabs'],
  },

  // ============================================
  // Monitoring & Analytics
  // ============================================
  sentry: {
    id: 'sentry',
    name: 'Sentry',
    icon: 'alert-triangle',
    category: 'monitoring',
    description: 'Error tracking and performance monitoring',
    docsUrl: 'https://docs.sentry.io',
    secrets: [
      {
        name: 'SENTRY_DSN',
        description: 'Data Source Name for error reporting',
        category: 'monitoring',
        required: true,
        isPublic: true,
      },
      {
        name: 'SENTRY_AUTH_TOKEN',
        description: 'Auth token for source map uploads',
        category: 'monitoring',
        required: false,
      },
      {
        name: 'SENTRY_ORG',
        description: 'Organization slug',
        category: 'monitoring',
        required: false,
      },
      {
        name: 'SENTRY_PROJECT',
        description: 'Project slug',
        category: 'monitoring',
        required: false,
      },
    ],
    features: ['error-tracking', 'performance', 'releases', 'alerts'],
    dependencies: ['@sentry/nextjs'],
  },

  posthog: {
    id: 'posthog',
    name: 'PostHog',
    icon: 'bar-chart',
    category: 'analytics',
    description: 'Product analytics and feature flags',
    docsUrl: 'https://posthog.com/docs',
    secrets: [
      {
        name: 'NEXT_PUBLIC_POSTHOG_KEY',
        description: 'PostHog project API key',
        category: 'monitoring',
        required: true,
        isPublic: true,
      },
      {
        name: 'NEXT_PUBLIC_POSTHOG_HOST',
        description: 'PostHog instance URL',
        category: 'monitoring',
        required: false,
        isPublic: true,
        example: 'https://app.posthog.com',
      },
    ],
    features: ['analytics', 'feature-flags', 'session-recording', 'surveys'],
    dependencies: ['posthog-js', 'posthog-node'],
  },

  // ============================================
  // Email
  // ============================================
  resend: {
    id: 'resend',
    name: 'Resend',
    icon: 'mail',
    category: 'email',
    description: 'Modern email API for developers',
    docsUrl: 'https://resend.com/docs',
    secrets: [
      {
        name: 'RESEND_API_KEY',
        description: 'Resend API key',
        category: 'api',
        required: true,
        pattern: '^re_[A-Za-z0-9]+$',
      },
    ],
    features: ['transactional-email', 'react-email', 'analytics'],
    dependencies: ['resend', '@react-email/components'],
  },

  sendgrid: {
    id: 'sendgrid',
    name: 'SendGrid',
    icon: 'send',
    category: 'email',
    description: 'Email delivery and marketing platform',
    docsUrl: 'https://docs.sendgrid.com',
    secrets: [
      {
        name: 'SENDGRID_API_KEY',
        description: 'SendGrid API key',
        category: 'api',
        required: true,
        pattern: '^SG\\.[A-Za-z0-9._-]+$',
      },
      {
        name: 'SENDGRID_FROM_EMAIL',
        description: 'Default sender email address',
        category: 'api',
        required: false,
      },
    ],
    features: ['transactional-email', 'marketing', 'templates'],
    dependencies: ['@sendgrid/mail'],
  },

  // ============================================
  // Storage
  // ============================================
  aws_s3: {
    id: 'aws_s3',
    name: 'AWS S3',
    icon: 'cloud',
    category: 'storage',
    description: 'Object storage with AWS S3',
    docsUrl: 'https://docs.aws.amazon.com/s3',
    secrets: [
      {
        name: 'AWS_ACCESS_KEY_ID',
        description: 'AWS access key ID',
        category: 'storage',
        required: true,
      },
      {
        name: 'AWS_SECRET_ACCESS_KEY',
        description: 'AWS secret access key',
        category: 'storage',
        required: true,
      },
      {
        name: 'AWS_REGION',
        description: 'AWS region (e.g., us-east-1)',
        category: 'storage',
        required: true,
        example: 'us-east-1',
      },
      {
        name: 'AWS_S3_BUCKET',
        description: 'S3 bucket name',
        category: 'storage',
        required: false,
      },
    ],
    features: ['object-storage', 'cdn', 'presigned-urls'],
    dependencies: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  },

  uploadthing: {
    id: 'uploadthing',
    name: 'UploadThing',
    icon: 'upload',
    category: 'storage',
    description: 'File uploads for Next.js',
    docsUrl: 'https://docs.uploadthing.com',
    secrets: [
      {
        name: 'UPLOADTHING_SECRET',
        description: 'UploadThing secret key',
        category: 'storage',
        required: true,
      },
      {
        name: 'UPLOADTHING_APP_ID',
        description: 'UploadThing app ID',
        category: 'storage',
        required: true,
      },
    ],
    features: ['file-upload', 'image-optimization', 'presigned-urls'],
    dependencies: ['uploadthing', '@uploadthing/react'],
  },
};

/**
 * Get integration by ID
 */
export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS[id];
}

/**
 * Get all integrations in a category
 */
export function getIntegrationsByCategory(category: IntegrationCategory): IntegrationDefinition[] {
  return Object.values(INTEGRATIONS).filter(i => i.category === category);
}

/**
 * Get all required secrets for an integration
 */
export function getRequiredSecrets(integrationId: string): SecretDefinition[] {
  const integration = INTEGRATIONS[integrationId];
  if (!integration) return [];
  return integration.secrets.filter(s => s.required);
}

/**
 * Get all secrets that can be auto-provisioned
 */
export function getAutoProvisionableSecrets(integrationId: string): SecretDefinition[] {
  const integration = INTEGRATIONS[integrationId];
  if (!integration) return [];
  return integration.secrets.filter(s => s.autoProvision);
}

/**
 * Validate secret value against pattern
 */
export function validateSecretValue(integrationId: string, secretName: string, value: string): boolean {
  const integration = INTEGRATIONS[integrationId];
  if (!integration) return true;
  
  const secret = integration.secrets.find(s => s.name === secretName);
  if (!secret || !secret.pattern) return true;
  
  return new RegExp(secret.pattern).test(value);
}

/**
 * Get all dependencies for selected integrations
 */
export function getDependencies(integrationIds: string[]): { dependencies: string[]; devDependencies: string[] } {
  const deps = new Set<string>();
  const devDeps = new Set<string>();
  
  for (const id of integrationIds) {
    const integration = INTEGRATIONS[id];
    if (!integration) continue;
    
    integration.dependencies.forEach(d => deps.add(d));
    integration.devDependencies?.forEach(d => devDeps.add(d));
  }
  
  return {
    dependencies: Array.from(deps).sort(),
    devDependencies: Array.from(devDeps).sort(),
  };
}

/**
 * Generate .env.example content for selected integrations
 */
export function generateEnvExample(integrationIds: string[]): string {
  const lines: string[] = [
    '# Environment Variables',
    '# Generated by Control Panel',
    '',
  ];
  
  for (const id of integrationIds) {
    const integration = INTEGRATIONS[id];
    if (!integration) continue;
    
    lines.push(`# ${integration.name}`);
    for (const secret of integration.secrets) {
      const required = secret.required ? '' : '# (optional) ';
      const example = secret.example ? `=${secret.example}` : '=';
      lines.push(`${required}${secret.name}${example}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// Types are already exported inline above
