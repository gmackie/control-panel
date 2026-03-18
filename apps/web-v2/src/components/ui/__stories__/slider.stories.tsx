import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Slider } from "../slider";

const meta: Meta<typeof Slider> = {
  title: "Primitives/Slider",
  component: Slider,
  decorators: [
    (Story) => (
      <div className="w-64 py-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: { defaultValue: [50], max: 100, step: 1 },
};

export const Range: Story = {
  args: { defaultValue: [25, 75], max: 100, step: 1 },
};

export const ReplicaCount: Story = {
  name: "Replica Count Pattern",
  render: () => (
    <div className="space-y-2 w-64">
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Replicas</span>
        <span className="font-mono text-[13px] tabular-nums">3</span>
      </div>
      <Slider defaultValue={[3]} min={1} max={10} step={1} />
      <div className="flex justify-between font-mono text-[11px] text-dim">
        <span>1</span>
        <span>10</span>
      </div>
    </div>
  ),
};
