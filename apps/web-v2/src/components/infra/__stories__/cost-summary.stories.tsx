import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";

/** Static presentational version of CostSummary for Storybook */
function CostSummaryStatic() {
  const health = {
    hetzner: { serverCount: 3, runningServers: 2, totalMonthlyCost: 24.9 },
    harbor: { imageCount: 47, storageUsed: 2_147_483_648 },
    gitea: { repositoryCount: 12 },
  };
  const costs = {
    breakdown: [
      { resource: "CX21 (k3s-master-1)", cost: 5.83 },
      { resource: "CX21 (k3s-worker-1)", cost: 5.83 },
      { resource: "CX11 (staging)", cost: 3.29 },
      { resource: "Volumes (3x 20GB)", cost: 3.60 },
      { resource: "Load Balancer", cost: 5.83 },
      { resource: "Floating IPs", cost: 0.52 },
    ],
    totalCost: 24.9,
    trend: { change: -2.3 },
  };

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4">Costs &amp; Capacity</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Hetzner Servers</p>
          <p className="text-2xl font-mono font-bold tabular-nums">
            {health.hetzner.serverCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {health.hetzner.runningServers} running &bull;{" "}
            <span className="font-mono tabular-nums">
              &euro;{health.hetzner.totalMonthlyCost.toFixed(2)}/mo
            </span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Harbor Registry</p>
          <p className="text-2xl font-mono font-bold tabular-nums">
            {health.harbor.imageCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            images &bull;{" "}
            <span className="font-mono tabular-nums">
              {formatBytes(health.harbor.storageUsed)}
            </span>{" "}
            used
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Gitea Repositories</p>
          <p className="text-2xl font-mono font-bold tabular-nums">
            {health.gitea.repositoryCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">repositories</p>
        </Card>
      </div>

      <div className="mt-4">
        <h3 className="font-display text-sm font-medium mb-2">Cost Breakdown</h3>
        <div className="space-y-1">
          {costs.breakdown.map((item) => (
            <div
              key={item.resource}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{item.resource}</span>
              <span className="font-mono tabular-nums">
                &euro;{item.cost.toFixed(2)}/mo
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm font-medium mt-2 pt-2 border-t border-border">
          <span>Total</span>
          <span className="font-mono tabular-nums">
            &euro;{costs.totalCost.toFixed(2)}/mo
            <span className="text-xs text-muted-foreground ml-2">
              ({costs.trend.change}%)
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

const meta: Meta<typeof CostSummaryStatic> = {
  title: "Components/CostSummary",
  component: CostSummaryStatic,
};

export default meta;
type Story = StoryObj<typeof CostSummaryStatic>;

export const Default: Story = {};

export const Loading: Story = {
  render: () => (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4">Costs &amp; Capacity</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    </section>
  ),
};
