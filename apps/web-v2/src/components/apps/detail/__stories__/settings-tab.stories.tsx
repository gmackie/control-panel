import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const meta: Meta = {
  title: "Detail Tabs/SettingsTab",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="space-y-6 max-w-2xl">
      {/* General */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">General</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>control-panel</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Slug</span><span className="font-mono text-[13px]">control-panel</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Repository</span><span className="text-primary font-mono text-[13px]">https://git.gmac.io/gmac/control-panel</span></div>
        </div>
      </Card>

      {/* Integrations */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold">Integrations</h3>
          <Button variant="ghost" size="sm" className="text-xs">Configure</Button>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { name: "Gitea", connected: true, detail: "Repository linked" },
            { name: "Kubernetes", connected: true, detail: "production + staging" },
            { name: "Sentry", connected: false, detail: "not connected" },
            { name: "PostHog", connected: false, detail: "not connected" },
          ].map((i) => (
            <div key={i.name} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${i.connected ? "bg-green-500" : "bg-neutral-400"}`} />
                <span>{i.name}</span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{i.detail}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Rollback Policy */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-4">Rollback Policy</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-rollback</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically rollback when alerts fire</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-2">Trigger on severity</p>
            <div className="flex items-center gap-4">
              {["critical", "warning", "info"].map((sev, i) => (
                <div key={sev} className="flex items-center gap-2">
                  <Checkbox id={`s-${sev}`} defaultChecked={i === 0} />
                  <Label htmlFor={`s-${sev}`} className="capitalize">{sev}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-2">Environments</p>
            <div className="flex items-center gap-4">
              {["production", "staging"].map((env, i) => (
                <div key={env} className="flex items-center gap-2">
                  <Switch defaultChecked={i === 0} />
                  <Label className="capitalize">{env}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-dim">Dedup window</p>
              <span className="font-mono text-[13px] tabular-nums">5m</span>
            </div>
            <Slider defaultValue={[5]} min={1} max={30} step={1} />
          </div>
          <Button size="sm">Save Policy</Button>
        </div>
      </Card>

      {/* Alert Thresholds */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-4">Alert Thresholds</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-dim">Error Rate (%)</Label>
            <Input defaultValue="5" className="font-mono text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-dim">P95 Latency (ms)</Label>
            <Input defaultValue="500" className="font-mono text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-dim">Memory (%)</Label>
            <Input defaultValue="80" className="font-mono text-[13px]" />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-dim">Slack Webhook URL</Label>
            <Input placeholder="https://hooks.slack.com/services/..." className="font-mono text-[13px]" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-2">Route by severity</p>
            <div className="space-y-2 text-sm">
              {[
                { severity: "Critical", channels: "Slack, PagerDuty" },
                { severity: "Warning", channels: "Slack" },
                { severity: "Info", channels: "Email" },
              ].map((r) => (
                <div key={r.severity} className="flex items-center justify-between py-1">
                  <Badge variant={r.severity === "Critical" ? "error" : r.severity === "Warning" ? "warning" : "secondary"} className="font-mono text-[11px]">{r.severity}</Badge>
                  <span className="text-muted-foreground font-mono text-[11px]">{r.channels}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  ),
};
