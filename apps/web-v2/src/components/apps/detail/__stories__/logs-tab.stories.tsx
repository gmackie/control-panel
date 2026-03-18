import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const meta: Meta = {
  title: "Detail Tabs/LogsTab",
};

export default meta;
type Story = StoryObj;

const sampleLines = [
  "2026-03-17T10:23:01.123Z [info] Server started on port 3000",
  "2026-03-17T10:23:01.456Z [info] Connected to database",
  "2026-03-17T10:23:02.789Z [info] Health check passed",
  "2026-03-17T10:23:05.012Z [info] GET /api/health 200 12ms",
  "2026-03-17T10:23:06.345Z [warn] High memory usage detected: 78%",
  "2026-03-17T10:23:07.678Z [info] GET /api/apps 200 45ms",
  "2026-03-17T10:23:08.901Z [info] GET /api/k8s/nodes 200 120ms",
  "2026-03-17T10:23:10.234Z [error] Failed to connect to Prometheus: ECONNREFUSED",
  "2026-03-17T10:23:12.567Z [info] Retrying Prometheus connection...",
  "2026-03-17T10:23:15.890Z [info] GET /api/apps 200 38ms",
  "2026-03-17T10:23:18.123Z [info] Prometheus connection restored",
  "2026-03-17T10:23:20.456Z [info] GET /api/k8s/pods 200 89ms",
];

export const Default: Story = {
  render: () => (
    <div className="space-y-4 max-w-4xl">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="font-mono text-[11px] uppercase tracking-wider text-dim">Cluster</label>
            <select className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono">
              <option>Production</option>
              <option>Staging</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[11px] uppercase tracking-wider text-dim">Pod</label>
            <select className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono max-w-[280px]">
              <option>control-panel-7f8b9c4d5-xk2j9 (Running)</option>
              <option>control-panel-7f8b9c4d5-m3n7p (Running)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[11px] uppercase tracking-wider text-dim">Tail lines</label>
            <select className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono">
              <option>100</option>
              <option>500</option>
            </select>
          </div>
          <Button variant="outline" size="sm" className="min-w-[80px]">Follow</Button>
          <Button variant="ghost" size="sm">Clear</Button>
        </div>
      </Card>

      {/* Log output */}
      <Card className="p-0 overflow-hidden">
        <div className="bg-[hsl(264,8%,6%)] rounded-md max-h-[600px] overflow-auto p-4">
          <pre className="text-[13px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {sampleLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "hover:bg-accent/50 px-1 -mx-1 rounded",
                  line.includes("error") && "text-red-400",
                  line.includes("warn") && "text-yellow-400"
                )}
              >
                {line}
              </div>
            ))}
          </pre>
        </div>
      </Card>
    </div>
  ),
};
