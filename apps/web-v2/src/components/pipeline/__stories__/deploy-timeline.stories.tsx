import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { DeployTimeline } from "../deploy-timeline";
import { mockTimelineEvents, mockTimelineWithFailure } from "@/__mocks__/fixtures";

const meta: Meta<typeof DeployTimeline> = {
  title: "Pipeline/DeployTimeline",
  component: DeployTimeline,
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DeployTimeline>;

export const Successful: Story = {
  args: { events: mockTimelineEvents },
};

export const WithFailure: Story = {
  args: { events: mockTimelineWithFailure },
};

export const InProgress: Story = {
  args: {
    events: [
      ...mockTimelineEvents.slice(0, 6),
      {
        id: "running",
        timestamp: new Date().toISOString(),
        status: "running" as const,
        title: "Deploy in progress",
        detail: "Rolling out 2 replicas...",
      },
    ],
  },
};
