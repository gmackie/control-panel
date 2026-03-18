import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { AppCard } from "../app-card";
import {
  healthyApp,
  degradedApp,
  unhealthyApp,
  minimalApp,
  allApps,
} from "@/__mocks__/fixtures";

const meta: Meta<typeof AppCard> = {
  title: "Components/AppCard",
  component: AppCard,
  args: {
    onClick: () => {},
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AppCard>;

export const Healthy: Story = {
  args: { app: healthyApp },
};

export const Degraded: Story = {
  args: { app: degradedApp },
};

export const Unhealthy: Story = {
  args: { app: unhealthyApp },
};

export const Minimal: Story = {
  name: "Minimal (Vercel, no metrics)",
  args: { app: minimalApp },
};

export const Grid: Story = {
  name: "Card Grid",
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {allApps.map((app) => (
        <AppCard key={app.id} app={app} onClick={() => {}} />
      ))}
    </div>
  ),
};
