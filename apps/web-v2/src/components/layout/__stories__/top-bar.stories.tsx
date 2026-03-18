import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { cn } from "@/lib/utils";

/** Static presentational TopBar for Storybook */
function TopBarStatic({
  title = "Applications",
  clusterStatus = "healthy" as "healthy" | "degraded" | "unhealthy" | "unknown",
  readyNodes = 3,
  totalNodes = 3,
}: {
  title?: string;
  clusterStatus?: "healthy" | "degraded" | "unhealthy" | "unknown";
  readyNodes?: number;
  totalNodes?: number;
}) {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6">
      <h1 className="font-display text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div
            className={cn("h-2.5 w-2.5 rounded-full", {
              "bg-green-500": clusterStatus === "healthy",
              "bg-yellow-500": clusterStatus === "degraded",
              "bg-red-500": clusterStatus === "unhealthy",
              "bg-neutral-400": clusterStatus === "unknown",
            })}
          />
          <span className="text-muted-foreground capitalize">{clusterStatus}</span>
          {clusterStatus !== "unknown" && (
            <span className="font-mono text-xs text-muted-foreground">
              ({readyNodes}/{totalNodes} nodes)
            </span>
          )}
        </div>
        <kbd className="hidden md:inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-dim">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}

const meta: Meta<typeof TopBarStatic> = {
  title: "Components/TopBar",
  component: TopBarStatic,
  argTypes: {
    title: { control: "text" },
    clusterStatus: {
      control: "select",
      options: ["healthy", "degraded", "unhealthy", "unknown"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TopBarStatic>;

export const Default: Story = {
  args: { title: "Applications" },
};

export const Infrastructure: Story = {
  args: { title: "Infrastructure" },
};

export const AppDetail: Story = {
  args: { title: "control-panel" },
};

export const DegradedCluster: Story = {
  args: { title: "Applications", clusterStatus: "degraded", readyNodes: 2, totalNodes: 3 },
};
