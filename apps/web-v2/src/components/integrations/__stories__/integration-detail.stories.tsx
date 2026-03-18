import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { IntegrationDetail } from "../integration-detail";
import type { IntegrationSummary, IntegrationResource, IntegrationCredential } from "@/types/integration";

const now = Date.now();

const tursoIntegration: IntegrationSummary = {
  provider: "turso",
  category: "databases",
  displayName: "Turso",
  connected: true,
  resourceCount: 4,
  syncStatus: "synced",
  lastSyncAt: new Date(now - 3600000).toISOString(),
};

const tursoResources: IntegrationResource[] = [
  { id: "r1", name: "control-panel-db", type: "database", linkedApp: "control-panel", linkedAppSlug: "control-panel", environment: "production", metadata: { region: "iad" } },
  { id: "r2", name: "control-panel-db-staging", type: "database", linkedApp: "control-panel", linkedAppSlug: "control-panel", environment: "staging", metadata: { region: "iad" } },
  { id: "r3", name: "gmac-web-db", type: "database", linkedApp: "gmac-web", linkedAppSlug: "gmac-web", metadata: { region: "iad" } },
  { id: "r4", name: "billing-db", type: "database", metadata: { region: "lhr" } },
];

const tursoCredential: IntegrationCredential = {
  provider: "turso",
  hasToken: true,
  environments: [
    { name: "production", configured: true },
    { name: "staging", configured: true },
  ],
};

const meta: Meta<typeof IntegrationDetail> = {
  title: "Integrations/IntegrationDetail",
  component: IntegrationDetail,
};

export default meta;
type Story = StoryObj<typeof IntegrationDetail>;

export const Default: Story = {
  args: {
    integration: tursoIntegration,
    resources: tursoResources,
    credential: tursoCredential,
  },
};

export const MissingToken: Story = {
  args: {
    integration: { ...tursoIntegration, provider: "sentry", displayName: "Sentry", syncStatus: "never" as const, resourceCount: 0 },
    resources: [],
    credential: { provider: "sentry", hasToken: false, environments: [{ name: "production", configured: false }, { name: "staging", configured: false }] },
  },
};

export const WithUnlinkedResources: Story = {
  args: {
    integration: tursoIntegration,
    resources: tursoResources.map((r, i) => i === 3 ? { ...r, linkedApp: undefined } : r),
    credential: tursoCredential,
    onLinkResource: (id) => alert(`Link resource ${id}`),
  },
};
