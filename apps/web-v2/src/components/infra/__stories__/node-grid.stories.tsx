import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { mockNodes } from "@/__mocks__/fixtures";
import type { MultiClusterNode } from "@/types/k8s";

function formatCpu(millis: number): string {
  return millis >= 1000 ? `${(millis / 1000).toFixed(1)} cores` : `${millis}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Static presentational version of NodeGrid for Storybook */
function NodeGridStatic({ nodes }: { nodes: MultiClusterNode[] }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4">Nodes</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {nodes.map((node) => (
          <Card key={`${node.clusterId}-${node.name}`} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-sm">{node.name}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {node.clusterId === "production" ? "prod" : "staging"}
                </span>
              </div>
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  node.status === "Ready" ? "bg-green-500" : "bg-red-500"
                )}
              />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>IP</span>
                <span className="font-mono">{node.internalIP}</span>
              </div>
              <div className="flex justify-between">
                <span>Role</span>
                <span className="font-mono capitalize">{node.roles.join(", ")}</span>
              </div>
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-mono">{node.kubeletVersion}</span>
              </div>
              <div className="flex justify-between">
                <span>CPU</span>
                <span className="font-mono tabular-nums">
                  {node.cpu.usageMillis != null
                    ? `${formatCpu(node.cpu.usageMillis)} / ${formatCpu(node.cpu.allocatableMillis)}`
                    : formatCpu(node.cpu.allocatableMillis)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Memory</span>
                <span className="font-mono tabular-nums">
                  {node.memory.usageBytes != null
                    ? `${formatBytes(node.memory.usageBytes)} / ${formatBytes(node.memory.allocatableBytes)}`
                    : formatBytes(node.memory.allocatableBytes)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Runtime</span>
                <span className="font-mono">{node.containerRuntime}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

const meta: Meta<typeof NodeGridStatic> = {
  title: "Components/NodeGrid",
  component: NodeGridStatic,
};

export default meta;
type Story = StoryObj<typeof NodeGridStatic>;

export const Default: Story = {
  args: { nodes: mockNodes },
};

export const SingleNode: Story = {
  args: { nodes: [mockNodes[2]] },
};

export const Empty: Story = {
  render: () => (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4">Nodes</h2>
      <p className="text-muted-foreground">No nodes found.</p>
    </section>
  ),
};

export const Loading: Story = {
  render: () => (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4">Nodes</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    </section>
  ),
};
