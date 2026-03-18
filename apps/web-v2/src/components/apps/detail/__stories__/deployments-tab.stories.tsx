import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const meta: Meta = {
  title: "Detail Tabs/DeploymentsTab",
};

export default meta;
type Story = StoryObj;

const deployments = [
  { id: "1", version: "v1.4.2", env: "production", sha: "f57fb6f", by: "ci/gitea", status: "succeeded", time: "12 minutes ago" },
  { id: "2", version: "v1.5.0-rc.1", env: "staging", sha: "a1b2c3d", by: "ci/gitea", status: "succeeded", time: "2 hours ago" },
  { id: "3", version: "v1.4.1", env: "production", sha: "e624865", by: "manual", status: "failed", time: "1 day ago" },
  { id: "4", version: "v1.4.0", env: "production", sha: "9273199", by: "ci/gitea", status: "succeeded", time: "3 days ago" },
  { id: "5", version: "v1.4.0-rc.2", env: "staging", sha: "ebd3a80", by: "ci/gitea", status: "succeeded", time: "4 days ago" },
];

export const Default: Story = {
  render: () => (
    <div className="space-y-4 max-w-3xl">
      {/* Live K8s Status */}
      <Card className="p-4 border-dashed">
        <h3 className="font-display text-sm font-semibold mb-3">Live K8s Status</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Production</span>
              <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                Healthy
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Deployment:</span> <span className="font-mono text-[13px]">default/control-panel</span></div>
              <div><span className="text-muted-foreground">Strategy:</span> <span className="font-mono text-[13px]">RollingUpdate</span></div>
              <div><span className="text-muted-foreground">Desired:</span> <span className="font-mono text-[13px] tabular-nums">2</span></div>
              <div><span className="text-muted-foreground">Ready:</span> <span className="font-mono text-[13px] tabular-nums text-green-500">2</span></div>
            </div>
          </div>
          <div className="rounded-md border border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Staging</span>
              <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                Healthy
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Deployment:</span> <span className="font-mono text-[13px]">default/control-panel</span></div>
              <div><span className="text-muted-foreground">Strategy:</span> <span className="font-mono text-[13px]">RollingUpdate</span></div>
              <div><span className="text-muted-foreground">Desired:</span> <span className="font-mono text-[13px] tabular-nums">1</span></div>
              <div><span className="text-muted-foreground">Ready:</span> <span className="font-mono text-[13px] tabular-nums text-green-500">1</span></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Environment filter */}
      <div className="flex items-center gap-2">
        {["all", "production", "staging", "development"].map((env, i) => (
          <Button key={env} variant={i === 0 ? "default" : "outline"} size="sm" className="capitalize">
            {env}
          </Button>
        ))}
      </div>

      {/* Deployment list */}
      <div className="space-y-2">
        {deployments.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("h-2.5 w-2.5 rounded-full", {
                  "bg-green-500": d.status === "succeeded",
                  "bg-red-500": d.status === "failed",
                })} />
                <div>
                  <div className="text-sm font-medium">{d.version}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {d.env} &bull; {d.sha} &bull; {d.by}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] capitalize text-muted-foreground">{d.status}</div>
                <div className="font-mono text-[13px] text-muted-foreground">{d.time}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  ),
};
