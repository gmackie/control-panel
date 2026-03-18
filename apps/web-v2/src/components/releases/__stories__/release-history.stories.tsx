import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ReleaseHistory } from "../release-history";
import { mockReleaseHistory } from "@/__mocks__/fixtures";

const meta: Meta<typeof ReleaseHistory> = {
  title: "Releases/ReleaseHistory",
  component: ReleaseHistory,
};

export default meta;
type Story = StoryObj<typeof ReleaseHistory>;

export const Collapsed: Story = {
  args: { items: mockReleaseHistory },
};

export const Expanded: Story = {
  args: { items: mockReleaseHistory, defaultExpanded: true },
};
