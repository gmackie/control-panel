import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ActiveReleasesBanner } from "../active-releases-banner";
import { ReleaseQueue } from "../release-queue";
import { ReleaseHistory } from "../release-history";
import {
  mockActiveReleases,
  mockReleaseQueue,
  mockReleaseHistory,
} from "@/__mocks__/fixtures";

const meta: Meta = {
  title: "Pages/Releases",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Releases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Release control room — monitor and manage deployments across all applications
        </p>
      </div>

      <ActiveReleasesBanner releases={mockActiveReleases} />

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Queue</h2>
        <ReleaseQueue items={mockReleaseQueue} />
      </section>

      <section>
        <ReleaseHistory items={mockReleaseHistory} defaultExpanded />
      </section>
    </div>
  ),
};

export const NothingActive: Story = {
  name: "Quiet — No Active Releases",
  render: () => (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Releases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Release control room — monitor and manage deployments across all applications
        </p>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Queue</h2>
        <ReleaseQueue items={mockReleaseQueue.filter((i) => i.status === "healthy")} />
      </section>

      <section>
        <ReleaseHistory items={mockReleaseHistory} defaultExpanded />
      </section>
    </div>
  ),
};
