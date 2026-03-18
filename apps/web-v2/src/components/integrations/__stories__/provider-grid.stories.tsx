import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ProviderGrid } from "../provider-grid";
import type { IntegrationSummary } from "@/types/integration";

const now = Date.now();

const mockIntegrations: IntegrationSummary[] = [
  { provider: "kubernetes", category: "infrastructure", displayName: "Kubernetes", connected: true, resourceCount: 3, syncStatus: "synced", lastSyncAt: new Date(now - 120000).toISOString() },
  { provider: "harbor", category: "infrastructure", displayName: "Harbor", connected: true, resourceCount: 47, syncStatus: "synced", lastSyncAt: new Date(now - 600000).toISOString() },
  { provider: "gitea", category: "source_control", displayName: "Gitea", connected: true, resourceCount: 12, syncStatus: "synced", lastSyncAt: new Date(now - 300000).toISOString() },
  { provider: "github", category: "source_control", displayName: "GitHub", connected: true, resourceCount: 2, syncStatus: "stale", lastSyncAt: new Date(now - 3600000).toISOString() },
  { provider: "turso", category: "databases", displayName: "Turso", connected: true, resourceCount: 4, syncStatus: "synced", lastSyncAt: new Date(now - 3600000).toISOString() },
  { provider: "neon", category: "databases", displayName: "Neon", connected: false, resourceCount: 0, syncStatus: "never" },
  { provider: "sentry", category: "services", displayName: "Sentry", connected: false, resourceCount: 0, syncStatus: "never" },
  { provider: "posthog", category: "services", displayName: "PostHog", connected: false, resourceCount: 0, syncStatus: "never" },
  { provider: "clerk", category: "services", displayName: "Clerk", connected: true, resourceCount: 3, syncStatus: "synced", lastSyncAt: new Date(now - 1800000).toISOString() },
  { provider: "stripe", category: "services", displayName: "Stripe", connected: true, resourceCount: 2, syncStatus: "error", lastSyncAt: new Date(now - 7200000).toISOString(), lastSyncError: "API key expired" },
];

const meta: Meta<typeof ProviderGrid> = {
  title: "Integrations/ProviderGrid",
  component: ProviderGrid,
};

export default meta;
type Story = StoryObj<typeof ProviderGrid>;

export const Default: Story = {
  args: { integrations: mockIntegrations },
};

export const AllConnected: Story = {
  args: {
    integrations: mockIntegrations.map((i) => ({
      ...i,
      connected: true,
      resourceCount: i.resourceCount || 1,
      syncStatus: "synced" as const,
      lastSyncAt: new Date(now - 120000).toISOString(),
    })),
  },
};

export const NoneConnected: Story = {
  args: {
    integrations: mockIntegrations.map((i) => ({
      ...i,
      connected: false,
      resourceCount: 0,
      syncStatus: "never" as const,
    })),
  },
};
