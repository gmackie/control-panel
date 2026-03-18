import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { HealthOverviewStrip } from "../health-overview-strip";
import { mockHealthMetrics } from "@/__mocks__/fixtures";

const meta: Meta<typeof HealthOverviewStrip> = {
  title: "Monitoring/HealthOverviewStrip",
  component: HealthOverviewStrip,
};

export default meta;
type Story = StoryObj<typeof HealthOverviewStrip>;

export const Default: Story = {
  args: { metrics: mockHealthMetrics },
};

export const WithThresholdBreach: Story = {
  name: "Threshold Breach",
  args: {
    metrics: [
      { label: "Error Rate", value: "12.5%", delta: { change: 2200 }, data: [0.1, 0.2, 0.3, 0.5, 1.2, 3.4, 8.7, 12.5], threshold: { value: 5, type: "above" }, deployMarkers: [4] },
      ...mockHealthMetrics.slice(1),
    ],
  },
};
