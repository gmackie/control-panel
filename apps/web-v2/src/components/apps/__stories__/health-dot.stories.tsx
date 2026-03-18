import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { HealthDot } from "../health-dot";

const meta: Meta<typeof HealthDot> = {
  title: "Components/HealthDot",
  component: HealthDot,
  argTypes: {
    status: {
      control: "select",
      options: ["healthy", "degraded", "unhealthy", "unknown"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
  },
  args: {
    status: "healthy",
    size: "md",
  },
};

export default meta;
type Story = StoryObj<typeof HealthDot>;

export const Healthy: Story = {};

export const Degraded: Story = {
  args: { status: "degraded" },
};

export const Unhealthy: Story = {
  args: { status: "unhealthy" },
};

export const Unknown: Story = {
  args: { status: "unknown" },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(["healthy", "degraded", "unhealthy", "unknown"] as const).map((status) => (
        <div key={status} className="flex items-center gap-2">
          <HealthDot status={status} />
          <span className="text-sm text-muted-foreground capitalize">{status}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <HealthDot status="healthy" size="sm" />
        <span className="text-sm text-muted-foreground">Small</span>
      </div>
      <div className="flex items-center gap-2">
        <HealthDot status="healthy" size="md" />
        <span className="text-sm text-muted-foreground">Medium</span>
      </div>
    </div>
  ),
};
