import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { SparklineCard } from "../sparkline-card";
import { mockSparklineData } from "@/__mocks__/fixtures";

const meta: Meta<typeof SparklineCard> = {
  title: "Monitoring/SparklineCard",
  component: SparklineCard,
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SparklineCard>;

export const Default: Story = {
  args: {
    label: "Error Rate",
    value: "0.3%",
    delta: { change: -12 },
    data: mockSparklineData,
  },
};

export const WithDeployMarker: Story = {
  name: "With Deploy Marker",
  args: {
    label: "P95 Latency",
    value: "142ms",
    delta: { change: -8 },
    data: mockSparklineData,
    deployMarkers: [18],
  },
};

export const OverThreshold: Story = {
  name: "Over Threshold",
  args: {
    label: "Error Rate",
    value: "12.5%",
    delta: { change: 2200 },
    data: [0.1, 0.2, 0.1, 0.3, 0.1, 0.2, 0.1, 0.1, 0.2, 0.3, 0.5, 1.2, 3.4, 8.7, 12.5, 11.2, 12.8, 12.5],
    threshold: { value: 5, type: "above" },
    deployMarkers: [10],
  },
};

export const NoDelta: Story = {
  args: {
    label: "Active Alerts",
    value: "2 firing",
    data: [1, 1, 2, 1, 0, 1, 2, 3, 2, 1, 1, 2],
  },
};

export const HealthStrip: Story = {
  name: "Health Overview Strip",
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <SparklineCard
        label="Error Rate"
        value="0.3%"
        delta={{ change: -12 }}
        data={mockSparklineData}
      />
      <SparklineCard
        label="P95 Latency"
        value="142ms"
        delta={{ change: -8 }}
        data={[142, 138, 145, 150, 142, 135, 140, 138, 142, 145, 140, 138, 135, 140, 142]}
      />
      <SparklineCard
        label="Active Alerts"
        value="2 firing"
        data={[1, 1, 2, 1, 0, 1, 2, 3, 2, 1, 1, 2]}
      />
      <SparklineCard
        label="Deploy Rate"
        value="3 today"
        data={[2, 1, 3, 0, 2, 4, 3]}
      />
      <SparklineCard
        label="Uptime"
        value="99.97%"
        delta={{ change: 0.02 }}
        data={[99.9, 99.95, 99.97, 99.95, 99.99, 99.97, 99.98, 99.97]}
      />
    </div>
  ),
};
