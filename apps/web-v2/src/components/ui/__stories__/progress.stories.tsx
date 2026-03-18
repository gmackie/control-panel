import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Progress } from "../progress";

const meta: Meta<typeof Progress> = {
  title: "Primitives/Progress",
  component: Progress,
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
  },
  args: {
    value: 60,
  },
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {};

export const Empty: Story = {
  args: { value: 0 },
};

export const Full: Story = {
  args: { value: 100 },
};

export const UsageBar: Story = {
  name: "Usage Bar Pattern",
  render: () => (
    <div className="space-y-3 w-64">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>CPU</span>
          <span className="font-mono tabular-nums">23%</span>
        </div>
        <Progress value={23} />
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Memory</span>
          <span className="font-mono tabular-nums">67%</span>
        </div>
        <Progress value={67} />
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Disk</span>
          <span className="font-mono tabular-nums">91%</span>
        </div>
        <Progress value={91} />
      </div>
    </div>
  ),
};
