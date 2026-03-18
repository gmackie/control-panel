import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { PipelineStepper } from "../pipeline-stepper";
import {
  successfulSteps,
  deployingSteps,
  failedSteps,
  buildingSteps,
  pendingSteps,
} from "@/__mocks__/fixtures";

const meta: Meta<typeof PipelineStepper> = {
  title: "Pipeline/PipelineStepper",
  component: PipelineStepper,
  argTypes: {
    compact: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof PipelineStepper>;

export const AllSucceeded: Story = {
  args: { steps: successfulSteps },
};

export const Deploying: Story = {
  args: { steps: deployingSteps },
};

export const TestsFailed: Story = {
  args: { steps: failedSteps },
};

export const Building: Story = {
  args: { steps: buildingSteps },
};

export const Pending: Story = {
  args: { steps: pendingSteps },
};

export const Compact: Story = {
  args: { steps: deployingSteps, compact: true },
};

export const CompactAllStates: Story = {
  name: "Compact — All States",
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground w-20">Succeeded</span>
        <PipelineStepper steps={successfulSteps} compact />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground w-20">Deploying</span>
        <PipelineStepper steps={deployingSteps} compact />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground w-20">Building</span>
        <PipelineStepper steps={buildingSteps} compact />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground w-20">Failed</span>
        <PipelineStepper steps={failedSteps} compact />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground w-20">Pending</span>
        <PipelineStepper steps={pendingSteps} compact />
      </div>
    </div>
  ),
};
