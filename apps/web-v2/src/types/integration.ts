export type IntegrationProvider =
  | "kubernetes"
  | "harbor"
  | "gitea"
  | "github"
  | "turso"
  | "neon"
  | "vercel"
  | "expo"
  | "sentry"
  | "posthog"
  | "clerk"
  | "stripe";

export type IntegrationCategory = "infrastructure" | "source_control" | "databases" | "services";

export type SyncStatus = "synced" | "stale" | "error" | "never";

export interface IntegrationSummary {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  displayName: string;
  connected: boolean;
  resourceCount: number;
  syncStatus: SyncStatus;
  lastSyncAt?: string;
  lastSyncError?: string;
}

export interface IntegrationResource {
  id: string;
  name: string;
  type: string;
  linkedApp?: string;
  linkedAppSlug?: string;
  environment?: string;
  metadata?: Record<string, string>;
}

export interface IntegrationCredential {
  provider: IntegrationProvider;
  hasToken: boolean;
  expiresAt?: string;
  environments: {
    name: string;
    configured: boolean;
  }[];
}

export const PROVIDER_CATEGORIES: Record<IntegrationCategory, IntegrationProvider[]> = {
  infrastructure: ["kubernetes", "harbor"],
  source_control: ["gitea", "github"],
  databases: ["turso", "neon"],
  services: ["sentry", "posthog", "clerk", "stripe"],
};

export const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  kubernetes: "Kubernetes",
  harbor: "Harbor",
  gitea: "Gitea",
  github: "GitHub",
  turso: "Turso",
  neon: "Neon",
  vercel: "Vercel",
  expo: "Expo",
  sentry: "Sentry",
  posthog: "PostHog",
  clerk: "Clerk",
  stripe: "Stripe",
};
