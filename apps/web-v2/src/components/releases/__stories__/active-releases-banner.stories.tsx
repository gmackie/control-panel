import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ActiveReleasesBanner } from "../active-releases-banner";
import { mockActiveReleases } from "@/__mocks__/fixtures";

const meta: Meta<typeof ActiveReleasesBanner> = {
  title: "Releases/ActiveReleasesBanner",
  component: ActiveReleasesBanner,
};

export default meta;
type Story = StoryObj<typeof ActiveReleasesBanner>;

export const Default: Story = {
  args: { releases: mockActiveReleases },
};

export const SingleDeploying: Story = {
  args: { releases: [mockActiveReleases[0]] },
};

export const AwaitingApproval: Story = {
  name: "Awaiting Approval (gold highlight)",
  args: { releases: [mockActiveReleases[1]] },
};

export const Empty: Story = {
  args: { releases: [] },
};

export const MultipleInFlight: Story = {
  name: "Multiple In-Flight",
  args: { releases: mockActiveReleases },
};
