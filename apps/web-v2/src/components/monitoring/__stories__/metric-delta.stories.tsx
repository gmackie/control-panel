import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { MetricDelta } from "../metric-delta";

const meta: Meta<typeof MetricDelta> = {
  title: "Monitoring/MetricDelta",
  component: MetricDelta,
};

export default meta;
type Story = StoryObj<typeof MetricDelta>;

export const Improved: Story = {
  args: {
    label: "Error Rate",
    current: 0.1,
    previous: 2.3,
    unit: "%",
  },
};

export const Regressed: Story = {
  args: {
    label: "P95 Latency",
    current: 340,
    previous: 142,
    unit: "ms",
  },
};

export const Neutral: Story = {
  args: {
    label: "CPU Usage",
    current: 24,
    previous: 23,
    unit: "%",
  },
};

export const InvertedGood: Story = {
  name: "Inverted (increase = good)",
  args: {
    label: "Uptime",
    current: 99.99,
    previous: 99.5,
    unit: "%",
    invertColor: true,
  },
};

export const ImpactSummary: Story = {
  name: "Impact Summary Pattern",
  render: () => (
    <div className="space-y-2 p-4 border border-border rounded-lg max-w-sm">
      <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">
        Impact Since Deploy
      </p>
      <MetricDelta label="Error Rate" current={0.3} previous={0.1} unit="%" />
      <MetricDelta label="P95 Latency" current={135} previous={142} unit="ms" />
      <MetricDelta label="CPU Usage" current={24} previous={23} unit="%" />
      <MetricDelta label="Memory" current={512} previous={490} unit="MB" />
    </div>
  ),
};
