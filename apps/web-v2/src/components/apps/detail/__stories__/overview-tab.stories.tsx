import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PipelineStepper } from "@/components/pipeline/pipeline-stepper";
import { cn } from "@/lib/utils";
import { successfulSteps, deployingSteps } from "@/__mocks__/fixtures";

const meta: Meta = {
  title: "Detail Tabs/OverviewTab",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="space-y-6 max-w-3xl">
      {/* Latest Pipeline */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold">Latest Pipeline</h3>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">f57fb6f</span>
            <Badge variant="success" className="font-mono text-[11px]">succeeded</Badge>
          </div>
        </div>
        <PipelineStepper steps={successfulSteps} />
        <p className="font-mono text-[11px] text-dim mt-3">production &bull; ci/gitea &bull; 12 minutes ago</p>
      </Card>

      {/* App Info */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Application Info</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Name:</span> control-panel</div>
          <div><span className="text-muted-foreground">Status:</span> <span className="font-mono text-[13px]">healthy</span></div>
          <div><span className="text-muted-foreground">Git:</span> <span className="font-mono text-[13px]">gitea</span></div>
          <div><span className="text-muted-foreground">Deploy:</span> <span className="font-mono text-[13px]">kubernetes</span></div>
        </div>
      </Card>

      {/* K8s Status */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">K8s Status</h3>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div><span className="text-muted-foreground">Replicas:</span> <span className="font-mono text-[13px] tabular-nums text-green-500">2/2</span></div>
          <div><span className="text-muted-foreground">Updated:</span> <span className="font-mono text-[13px] tabular-nums">2</span></div>
          <div><span className="text-muted-foreground">Strategy:</span> <span className="font-mono text-[13px]">RollingUpdate</span></div>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {[
            { title: "Deployment succeeded (production)", severity: "info", time: "12 min ago" },
            { title: "Image pushed to Harbor", severity: "info", time: "14 min ago" },
            { title: "CI pipeline completed", severity: "info", time: "15 min ago" },
            { title: "Memory spike alert (resolved)", severity: "warning", time: "2 hrs ago" },
          ].map((event, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", event.severity === "warning" ? "bg-yellow-500" : "bg-green-500")} />
                <span>{event.title}</span>
              </div>
              <span className="font-mono text-[11px] text-dim">{event.time}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Deployments */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Recent Deployments</h3>
        {[
          { env: "production", sha: "f57fb6f", status: "succeeded", time: "12 min ago" },
          { env: "staging", sha: "a1b2c3d", status: "succeeded", time: "2 hrs ago" },
        ].map((d, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>{d.env}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{d.sha}</span>
            </div>
            <span className="font-mono text-[13px] text-muted-foreground">{d.time}</span>
          </div>
        ))}
      </Card>
    </div>
  ),
};

export const ActiveDeploy: Story = {
  name: "With Active Deploy",
  render: () => (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold">Latest Pipeline</h3>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">a1b2c3d</span>
            <Badge variant="secondary" className="font-mono text-[11px]">deploying</Badge>
          </div>
        </div>
        <PipelineStepper steps={deployingSteps} />
        <p className="font-mono text-[11px] text-dim mt-3">production &bull; ci/gitea &bull; 25 seconds ago</p>
      </Card>
    </div>
  ),
};
