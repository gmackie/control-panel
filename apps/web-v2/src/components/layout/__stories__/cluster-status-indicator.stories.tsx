import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { cn } from "@/lib/utils";

type ClusterStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/** Static presentational version of ClusterStatusIndicator for Storybook */
function ClusterStatusStatic({
  status,
  readyNodes,
  totalNodes,
}: {
  status: ClusterStatus;
  readyNodes?: number;
  totalNodes?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn("h-2.5 w-2.5 rounded-full", {
          "bg-green-500": status === "healthy",
          "bg-yellow-500": status === "degraded",
          "bg-red-500": status === "unhealthy",
          "bg-neutral-400": status === "unknown",
        })}
      />
      <span className="text-muted-foreground capitalize">{status}</span>
      {readyNodes != null && totalNodes != null && status !== "unknown" && (
        <span className="font-mono text-xs text-muted-foreground">
          ({readyNodes}/{totalNodes} nodes)
        </span>
      )}
    </div>
  );
}

const meta: Meta<typeof ClusterStatusStatic> = {
  title: "Components/ClusterStatusIndicator",
  component: ClusterStatusStatic,
  argTypes: {
    status: {
      control: "select",
      options: ["healthy", "degraded", "unhealthy", "unknown"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ClusterStatusStatic>;

export const Healthy: Story = {
  args: { status: "healthy", readyNodes: 3, totalNodes: 3 },
};

export const Degraded: Story = {
  args: { status: "degraded", readyNodes: 2, totalNodes: 3 },
};

export const Unhealthy: Story = {
  args: { status: "unhealthy", readyNodes: 0, totalNodes: 3 },
};

export const Unknown: Story = {
  args: { status: "unknown" },
};

export const InTopBar: Story = {
  name: "In Top Bar Context",
  render: () => (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6">
      <h1 className="font-display text-base font-semibold">Applications</h1>
      <div className="flex items-center gap-4">
        <ClusterStatusStatic status="healthy" readyNodes={3} totalNodes={3} />
        <kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-dim">
          ⌘K
        </kbd>
      </div>
    </header>
  ),
};
