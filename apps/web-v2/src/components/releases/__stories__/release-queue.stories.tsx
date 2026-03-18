import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ReleaseQueue } from "../release-queue";
import { mockReleaseQueue } from "@/__mocks__/fixtures";

const meta: Meta<typeof ReleaseQueue> = {
  title: "Releases/ReleaseQueue",
  component: ReleaseQueue,
};

export default meta;
type Story = StoryObj<typeof ReleaseQueue>;

export const Default: Story = {
  args: { items: mockReleaseQueue },
};

export const Empty: Story = {
  args: { items: [] },
};

export const WithPromote: Story = {
  name: "With Promote Button",
  args: {
    items: mockReleaseQueue,
    onPromote: (id) => alert(`Promote ${id}`),
  },
};
