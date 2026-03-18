import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const meta: Meta = {
  title: "Detail Tabs/AlertsTab",
};

export default meta;
type Story = StoryObj;

const alerts = [
  {
    id: "1",
    message: "Pod CrashLoopBackOff: api-gateway-6a5b4c3d2-q8r7s",
    severity: "critical" as const,
    status: "firing" as const,
    source: "kubernetes",
    time: "5 minutes ago",
  },
  {
    id: "2",
    message: "High memory usage on k3s-worker-1 (78%)",
    severity: "warning" as const,
    status: "firing" as const,
    source: "prometheus",
    time: "12 minutes ago",
  },
  {
    id: "3",
    message: "SSL certificate expires in 14 days",
    severity: "warning" as const,
    status: "acknowledged" as const,
    source: "certmanager",
    time: "2 hours ago",
    acked: "gmackie",
  },
  {
    id: "4",
    message: "Error rate above threshold (2.3%)",
    severity: "info" as const,
    status: "resolved" as const,
    source: "prometheus",
    time: "1 day ago",
  },
];

export const Default: Story = {
  render: () => (
    <div className="space-y-4 max-w-3xl">
      {/* Severity filter */}
      <div className="flex items-center gap-2">
        {["all", "critical", "warning", "info"].map((sev, i) => (
          <Button key={sev} variant={i === 0 ? "default" : "outline"} size="sm" className="capitalize">
            {sev}
          </Button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {alerts.map((alert) => (
          <Card key={alert.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={cn("h-2.5 w-2.5 rounded-full mt-1.5 shrink-0", {
                    "bg-red-500": alert.severity === "critical",
                    "bg-yellow-500": alert.severity === "warning",
                    "bg-blue-500": alert.severity === "info",
                  })}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={alert.severity === "critical" ? "error" : alert.severity === "warning" ? "warning" : "secondary"}
                      className="font-mono text-[11px]"
                    >
                      {alert.severity}
                    </Badge>
                    <Badge
                      variant={alert.status === "firing" ? "error" : alert.status === "acknowledged" ? "warning" : "success"}
                      className="font-mono text-[11px]"
                    >
                      {alert.status}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">{alert.source}</span>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground mt-1">
                    Started {alert.time}
                    {alert.acked && <> &bull; Acked by {alert.acked}</>}
                  </p>
                </div>
              </div>
              {alert.status === "firing" && (
                <Button variant="outline" size="sm" className="shrink-0">Acknowledge</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        {["all", "critical", "warning", "info"].map((sev, i) => (
          <Button key={sev} variant={i === 0 ? "default" : "outline"} size="sm" className="capitalize">
            {sev}
          </Button>
        ))}
      </div>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">No alerts found.</p>
      </Card>
    </div>
  ),
};
