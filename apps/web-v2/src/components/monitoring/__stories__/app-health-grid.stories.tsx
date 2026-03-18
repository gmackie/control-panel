import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { AppHealthGrid } from "../app-health-grid";
import { mockAppHealth } from "@/__mocks__/fixtures";

const meta: Meta<typeof AppHealthGrid> = {
  title: "Monitoring/AppHealthGrid",
  component: AppHealthGrid,
};

export default meta;
type Story = StoryObj<typeof AppHealthGrid>;

export const Default: Story = {
  args: { apps: mockAppHealth },
};

export const AllHealthy: Story = {
  args: {
    apps: mockAppHealth.map((a) => ({
      ...a,
      status: "healthy" as const,
      errorRate: 0.1,
      latencyMs: 100,
      activeAlerts: 0,
    })),
  },
};

export const Incident: Story = {
  name: "During Incident",
  args: {
    apps: mockAppHealth.map((a) =>
      a.slug === "api-gateway"
        ? { ...a, status: "unhealthy" as const, errorRate: 25, latencyMs: 5000, activeAlerts: 5 }
        : a
    ),
  },
};
