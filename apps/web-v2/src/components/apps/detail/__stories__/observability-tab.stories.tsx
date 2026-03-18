import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Cpu, HardDrive, Activity, AlertTriangle, Timer } from "lucide-react";

const meta: Meta = {
  title: "Detail Tabs/ObservabilityTab",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const stats = [
      { label: "CPU Usage", value: "23%", icon: Cpu, color: "text-green-500" },
      { label: "Memory", value: "512 MB", icon: HardDrive, color: "text-green-500" },
      { label: "Requests/s", value: "142", icon: Activity, color: "text-blue-500" },
      { label: "Error Rate", value: "0.1%", icon: AlertTriangle, color: "text-green-500" },
      { label: "P95 Latency", value: "142 ms", icon: Timer, color: "text-green-500" },
    ];

    const alerts = [
      { id: "1", severity: "warning" as const, message: "Memory usage trending up (72%)", time: "12 min ago" },
      { id: "2", severity: "info" as const, message: "New Sentry errors detected (3)", time: "1 hr ago" },
    ];

    const logLines = [
      "2026-03-17T10:23:01Z [info] Server started on port 3000",
      "2026-03-17T10:23:05Z [info] GET /api/health 200 12ms",
      "2026-03-17T10:23:06Z [warn] High memory usage: 72%",
      "2026-03-17T10:23:07Z [info] GET /api/apps 200 45ms",
      "2026-03-17T10:23:10Z [error] Failed to connect to Prometheus",
    ];

    return (
      <div className="space-y-6 max-w-4xl">
        {/* Metrics */}
        <section>
          <h3 className="font-display text-sm font-semibold mb-3">Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <p className={cn("text-lg font-mono font-bold tabular-nums", stat.color)}>{stat.value}</p>
              </Card>
            ))}
          </div>
          <p className="font-mono text-[11px] text-dim mt-2">Metrics sourced from Prometheus. Auto-refreshes every 30s.</p>
        </section>

        {/* Error Tracking */}
        <section>
          <h3 className="font-display text-sm font-semibold mb-3">Error Tracking</h3>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Connect Sentry in <span className="text-primary">Integrations</span> to see error tracking data here.
            </p>
          </Card>
        </section>

        {/* Alerts */}
        <section>
          <h3 className="font-display text-sm font-semibold mb-3">Alerts (2)</h3>
          <div className="space-y-1.5">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", a.severity === "warning" ? "bg-yellow-500" : "bg-blue-400")} />
                  <span className="text-sm">{a.message}</span>
                  <Badge variant={a.severity === "warning" ? "warning" : "secondary"} className="font-mono text-[11px]">{a.severity}</Badge>
                </div>
                <span className="font-mono text-[11px] text-dim">{a.time}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Logs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold">Logs</h3>
            <Button variant="outline" size="sm">Hide Logs</Button>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="bg-[hsl(264,8%,6%)] rounded-md max-h-[300px] overflow-auto p-4">
              <pre className="text-[13px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {logLines.map((line, i) => (
                  <div key={i} className={cn(
                    "hover:bg-accent/50 px-1 -mx-1 rounded",
                    line.includes("error") && "text-red-400",
                    line.includes("warn") && "text-yellow-400"
                  )}>{line}</div>
                ))}
              </pre>
            </div>
          </Card>
        </section>
      </div>
    );
  },
};
