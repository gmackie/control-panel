import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { DeploymentDetailDrawer } from "../deployment-detail-drawer";
import {
  mockJourneyHealthy,
  mockJourneyDeploying,
  mockJourneyFailed,
  mockJourneyStaging,
} from "@/__mocks__/fixtures";

const meta: Meta<typeof DeploymentDetailDrawer> = {
  title: "Pipeline/DeploymentDetailDrawer",
  component: DeploymentDetailDrawer,
  parameters: { layout: "fullscreen" },
  args: {
    onClose: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof DeploymentDetailDrawer>;

export const Healthy: Story = {
  args: {
    deployment: mockJourneyHealthy,
    impact: {
      errorRate: { current: 0.3, previous: 0.1 },
      latency: { current: 135, previous: 142 },
      cpu: { current: 24, previous: 23 },
    },
  },
};

export const Deploying: Story = {
  args: {
    deployment: mockJourneyDeploying,
  },
};

export const Failed: Story = {
  args: {
    deployment: mockJourneyFailed,
    impact: {
      errorRate: { current: 12.5, previous: 0.1 },
      latency: { current: 2400, previous: 142 },
    },
  },
};

export const StagingWithPromote: Story = {
  name: "Staging (with Promote button)",
  args: {
    deployment: mockJourneyStaging,
  },
};

export const Closed: Story = {
  args: { deployment: null },
};
