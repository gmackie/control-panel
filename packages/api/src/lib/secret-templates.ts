/**
 * Integration Provider Secret Templates
 *
 * Each provider defines the env vars it needs. Templates drive:
 * - The IntegrationSetupWizard UI (which fields to render)
 * - Validation in the tRPC secrets router
 * - Category grouping in the SecretEditor
 *
 * Templates are static config — not stored in DB.
 */

export type SecretCategory =
  | "database"
  | "auth"
  | "monitoring"
  | "email"
  | "payments"
  | "analytics"
  | "custom";

export interface SecretField {
  key: string;
  label: string;
  required: boolean;
  sensitive: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: string;
  /** If true, this is a NEXT_PUBLIC_ var (baked into client bundle) */
  isPublic?: boolean;
}

export interface ProviderTemplate {
  provider: string;
  displayName: string;
  category: SecretCategory;
  description: string;
  fields: SecretField[];
  /** Optional sub-sections (e.g., OAuth providers under BetterAuth) */
  sections?: {
    id: string;
    label: string;
    description?: string;
    toggleable?: boolean;
    fields: SecretField[];
  }[];
  /** Optional health check endpoint for validation */
  healthCheck?: {
    /** Which field's value to use as the API token */
    tokenField: string;
    /** URL to test (can contain {value} placeholders) */
    testUrl: string;
    /** Expected HTTP method */
    method?: "GET" | "POST";
    /** Headers to send */
    headers?: Record<string, string>;
  };
  /** Auto-generated webhook URL pattern */
  webhookUrl?: {
    path: string;
    description: string;
  };
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  // ── Database ───────────────────────────────────────────
  {
    provider: "postgres",
    displayName: "PostgreSQL",
    category: "database",
    description: "PostgreSQL database connection",
    fields: [
      { key: "DATABASE_URL", label: "Connection URL", required: true, sensitive: true, placeholder: "postgres://user:pass@host:5432/db" },
      { key: "DATABASE_URL_READONLY", label: "Read Replica URL", required: false, sensitive: true, placeholder: "postgres://user:pass@replica:5432/db" },
      { key: "DATABASE_POOL_URL", label: "Connection Pool URL", required: false, sensitive: true, placeholder: "postgres://user:pass@pooler:6543/db" },
    ],
  },
  {
    provider: "neon",
    displayName: "Neon",
    category: "database",
    description: "Neon serverless PostgreSQL",
    fields: [
      { key: "DATABASE_URL", label: "Connection URL", required: true, sensitive: true, placeholder: "postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/db" },
      { key: "NEON_API_KEY", label: "API Key", required: false, sensitive: true, placeholder: "napi_...", description: "Enables project/branch listing in the dashboard" },
    ],
    healthCheck: {
      tokenField: "NEON_API_KEY",
      testUrl: "https://console.neon.tech/api/v2/projects",
      headers: { "Accept": "application/json" },
    },
  },
  {
    provider: "turso",
    displayName: "Turso",
    category: "database",
    description: "Turso distributed SQLite",
    fields: [
      { key: "TURSO_DATABASE_URL", label: "Database URL", required: true, sensitive: true, placeholder: "libsql://db-org.turso.io" },
      { key: "TURSO_AUTH_TOKEN", label: "Auth Token", required: true, sensitive: true },
    ],
    healthCheck: {
      tokenField: "TURSO_AUTH_TOKEN",
      testUrl: "https://api.turso.tech/v1/organizations",
      headers: { "Accept": "application/json" },
    },
  },

  // ── Authentication ────────────────────────────────────
  {
    provider: "betterauth",
    displayName: "BetterAuth",
    category: "auth",
    description: "Authentication with OAuth and SAML support",
    fields: [
      { key: "BETTER_AUTH_SECRET", label: "Signing Secret", required: true, sensitive: true, description: "Used to sign JWTs and session tokens" },
      { key: "BETTER_AUTH_URL", label: "App URL", required: true, sensitive: false, placeholder: "https://myapp.com", description: "Your application's public URL" },
    ],
    sections: [
      {
        id: "github",
        label: "GitHub OAuth",
        toggleable: true,
        fields: [
          { key: "AUTH_GITHUB_CLIENT_ID", label: "Client ID", required: true, sensitive: false, placeholder: "Iv1.xxxx" },
          { key: "AUTH_GITHUB_CLIENT_SECRET", label: "Client Secret", required: true, sensitive: true },
        ],
      },
      {
        id: "google",
        label: "Google OAuth",
        toggleable: true,
        fields: [
          { key: "AUTH_GOOGLE_CLIENT_ID", label: "Client ID", required: true, sensitive: false, placeholder: "xxxx.apps.googleusercontent.com" },
          { key: "AUTH_GOOGLE_CLIENT_SECRET", label: "Client Secret", required: true, sensitive: true },
        ],
      },
      {
        id: "azure_ad",
        label: "Azure AD / Entra ID",
        toggleable: true,
        fields: [
          { key: "AUTH_AZURE_AD_CLIENT_ID", label: "Application (client) ID", required: true, sensitive: false },
          { key: "AUTH_AZURE_AD_CLIENT_SECRET", label: "Client Secret", required: true, sensitive: true },
          { key: "AUTH_AZURE_AD_TENANT_ID", label: "Tenant ID", required: true, sensitive: false },
        ],
      },
      {
        id: "saml",
        label: "SAML SSO",
        toggleable: true,
        description: "Enterprise single sign-on via SAML 2.0",
        fields: [
          { key: "AUTH_SAML_ISSUER", label: "SP Entity ID / Issuer", required: true, sensitive: false },
          { key: "AUTH_SAML_SSO_URL", label: "IdP SSO URL", required: true, sensitive: false, placeholder: "https://idp.example.com/sso/saml" },
          { key: "AUTH_SAML_CERTIFICATE", label: "IdP Certificate (PEM)", required: true, sensitive: true, description: "X.509 certificate from your identity provider" },
          { key: "AUTH_SAML_CALLBACK_URL", label: "ACS Callback URL", required: false, sensitive: false, description: "Auto-generated from your app URL" },
        ],
      },
    ],
  },
  {
    provider: "clerk",
    displayName: "Clerk",
    category: "auth",
    description: "Clerk authentication service",
    fields: [
      { key: "CLERK_SECRET_KEY", label: "Secret Key", required: true, sensitive: true, placeholder: "sk_live_..." },
      { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", label: "Publishable Key", required: true, sensitive: false, isPublic: true, placeholder: "pk_live_..." },
    ],
    healthCheck: {
      tokenField: "CLERK_SECRET_KEY",
      testUrl: "https://api.clerk.com/v1/users?limit=1",
      headers: { "Accept": "application/json" },
    },
  },

  // ── Monitoring ────────────────────────────────────────
  {
    provider: "sentry",
    displayName: "Sentry",
    category: "monitoring",
    description: "Error tracking and performance monitoring",
    fields: [
      { key: "SENTRY_DSN", label: "DSN", required: true, sensitive: false, placeholder: "https://abc@o123.ingest.sentry.io/456" },
      { key: "SENTRY_AUTH_TOKEN", label: "Auth Token", required: false, sensitive: true, description: "Enables issue feed in Observability tab" },
      { key: "SENTRY_ORG", label: "Organization Slug", required: false, sensitive: false },
      { key: "SENTRY_PROJECT", label: "Project Slug", required: false, sensitive: false },
    ],
    healthCheck: {
      tokenField: "SENTRY_AUTH_TOKEN",
      testUrl: "https://sentry.io/api/0/organizations/",
      headers: { "Accept": "application/json" },
    },
  },

  // ── Analytics ─────────────────────────────────────────
  {
    provider: "posthog",
    displayName: "PostHog",
    category: "analytics",
    description: "Product analytics and feature flags",
    fields: [
      { key: "NEXT_PUBLIC_POSTHOG_KEY", label: "Project API Key", required: true, sensitive: false, isPublic: true },
      { key: "NEXT_PUBLIC_POSTHOG_HOST", label: "Host URL", required: true, sensitive: false, isPublic: true, defaultValue: "https://us.i.posthog.com" },
      { key: "POSTHOG_API_KEY", label: "Personal API Key", required: false, sensitive: true, description: "Enables analytics feed in Observability tab" },
    ],
    healthCheck: {
      tokenField: "POSTHOG_API_KEY",
      testUrl: "https://us.i.posthog.com/api/projects/",
      headers: { "Accept": "application/json" },
    },
  },

  // ── Email ─────────────────────────────────────────────
  {
    provider: "resend",
    displayName: "Resend",
    category: "email",
    description: "Transactional email delivery",
    fields: [
      { key: "RESEND_API_KEY", label: "API Key", required: true, sensitive: true, placeholder: "re_..." },
    ],
    healthCheck: {
      tokenField: "RESEND_API_KEY",
      testUrl: "https://api.resend.com/domains",
      headers: { "Accept": "application/json" },
    },
  },
  {
    provider: "sendgrid",
    displayName: "SendGrid",
    category: "email",
    description: "Email delivery service",
    fields: [
      { key: "SENDGRID_API_KEY", label: "API Key", required: true, sensitive: true, placeholder: "SG...." },
    ],
    healthCheck: {
      tokenField: "SENDGRID_API_KEY",
      testUrl: "https://api.sendgrid.com/v3/user/profile",
      headers: { "Accept": "application/json" },
    },
  },

  // ── Payments ──────────────────────────────────────────
  {
    provider: "stripe",
    displayName: "Stripe",
    category: "payments",
    description: "Payment processing",
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "Secret Key", required: true, sensitive: true, placeholder: "sk_live_..." },
      { key: "STRIPE_PUBLISHABLE_KEY", label: "Publishable Key", required: true, sensitive: false, isPublic: true, placeholder: "pk_live_..." },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook Signing Secret", required: true, sensitive: true, placeholder: "whsec_..." },
    ],
    healthCheck: {
      tokenField: "STRIPE_SECRET_KEY",
      testUrl: "https://api.stripe.com/v1/balance",
    },
    webhookUrl: {
      path: "/api/webhooks/stripe",
      description: "Paste this URL into your Stripe webhook settings",
    },
  },
];

/** Get template by provider name */
export function getTemplate(provider: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.provider === provider);
}

/** Get all templates for a category */
export function getTemplatesByCategory(category: SecretCategory): ProviderTemplate[] {
  return PROVIDER_TEMPLATES.filter((t) => t.category === category);
}

/** Get all fields for a provider (including section fields) */
export function getAllFields(template: ProviderTemplate): SecretField[] {
  const fields = [...template.fields];
  if (template.sections) {
    for (const section of template.sections) {
      fields.push(...section.fields);
    }
  }
  return fields;
}

/** Category display labels */
export const CATEGORY_LABELS: Record<SecretCategory, string> = {
  database: "Database",
  auth: "Authentication",
  monitoring: "Monitoring",
  email: "Email",
  payments: "Payments",
  analytics: "Analytics",
  custom: "Custom",
};

/** Category display order */
export const CATEGORY_ORDER: SecretCategory[] = [
  "database",
  "auth",
  "monitoring",
  "analytics",
  "email",
  "payments",
  "custom",
];
