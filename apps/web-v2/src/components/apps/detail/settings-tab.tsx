"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { SecretEditor } from "@/components/secrets/secret-editor";

export function SettingsTab({ appId }: { appId: string }) {
  const { data: app, isLoading } =
    trpc.applications.bySlug.useQuery(appId);

  // Local state for rollback policy (would be loaded from releasePolicies.byEnvironment)
  const [autoRollback, setAutoRollback] = useState(true);
  const [rollbackSeverities, setRollbackSeverities] = useState({
    critical: true,
    warning: false,
    info: false,
  });
  const [rollbackEnvs, setRollbackEnvs] = useState({
    production: true,
    staging: false,
  });
  const [dedupeWindow, setDedupeWindow] = useState([5]);

  // Local state for alert thresholds
  const [errorThreshold, setErrorThreshold] = useState("5");
  const [latencyThreshold, setLatencyThreshold] = useState("500");
  const [memoryThreshold, setMemoryThreshold] = useState("80");

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* General */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">General</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{app?.name ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slug</span>
            <span className="font-mono text-[13px]">{app?.slug ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span>{app?.description || "No description"}</span>
          </div>
          {app?.repositoryUrl && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Repository</span>
              <a
                href={app.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono text-[13px]"
              >
                {app.repositoryUrl}
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Providers */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Providers</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Git Provider</span>
            <span className="font-mono text-[13px] capitalize">{app?.gitProvider ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deploy Provider</span>
            <span className="font-mono text-[13px] capitalize">{app?.deployProvider ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Database Provider</span>
            <span className="font-mono text-[13px] capitalize">{app?.dbProvider ?? "\u2014"}</span>
          </div>
        </div>
      </Card>

      {/* Integrations */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold">Integrations</h3>
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <a href="/integrations">Configure</a>
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { name: "Gitea", status: "connected", resource: app?.repositoryUrl ? "Repository linked" : undefined },
            { name: "Kubernetes", status: app?.deployProvider === "kubernetes" ? "connected" : "not configured" },
            { name: "Sentry", status: "not connected" },
            { name: "PostHog", status: "not connected" },
          ].map((integration) => (
            <div key={integration.name} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${integration.status === "connected" ? "bg-green-500" : "bg-neutral-400"}`} />
                <span>{integration.name}</span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {integration.resource ?? integration.status}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Rollback Policy */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-4">Rollback Policy</h3>
        <div className="space-y-4">
          {/* Auto-rollback toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-rollback</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically rollback when alerts fire
              </p>
            </div>
            <Switch checked={autoRollback} onCheckedChange={setAutoRollback} />
          </div>

          {autoRollback && (
            <>
              {/* Severity filter */}
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-2">
                  Trigger on severity
                </p>
                <div className="flex items-center gap-4">
                  {(["critical", "warning", "info"] as const).map((sev) => (
                    <div key={sev} className="flex items-center gap-2">
                      <Checkbox
                        id={`sev-${sev}`}
                        checked={rollbackSeverities[sev]}
                        onCheckedChange={(checked) =>
                          setRollbackSeverities((prev) => ({ ...prev, [sev]: checked }))
                        }
                      />
                      <Label htmlFor={`sev-${sev}`} className="capitalize">{sev}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Environment scope */}
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-2">
                  Environments
                </p>
                <div className="flex items-center gap-4">
                  {(["production", "staging"] as const).map((env) => (
                    <div key={env} className="flex items-center gap-2">
                      <Switch
                        id={`env-${env}`}
                        checked={rollbackEnvs[env]}
                        onCheckedChange={(checked) =>
                          setRollbackEnvs((prev) => ({ ...prev, [env]: checked }))
                        }
                      />
                      <Label htmlFor={`env-${env}`} className="capitalize">{env}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dedup window */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-dim">
                    Dedup window
                  </p>
                  <span className="font-mono text-[13px] tabular-nums">{dedupeWindow[0]}m</span>
                </div>
                <Slider
                  value={dedupeWindow}
                  onValueChange={setDedupeWindow}
                  min={1}
                  max={30}
                  step={1}
                />
                <div className="flex justify-between font-mono text-[11px] text-dim mt-1">
                  <span>1m</span>
                  <span>30m</span>
                </div>
              </div>
            </>
          )}

          <Button size="sm" className="mt-2">Save Policy</Button>
        </div>
      </Card>

      {/* Alert Thresholds */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-4">Alert Thresholds</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Alerts fire when metrics exceed these thresholds.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="err-threshold" className="font-mono text-[11px] uppercase tracking-wider text-dim">
                Error Rate (%)
              </Label>
              <Input
                id="err-threshold"
                value={errorThreshold}
                onChange={(e) => setErrorThreshold(e.target.value)}
                className="font-mono text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lat-threshold" className="font-mono text-[11px] uppercase tracking-wider text-dim">
                P95 Latency (ms)
              </Label>
              <Input
                id="lat-threshold"
                value={latencyThreshold}
                onChange={(e) => setLatencyThreshold(e.target.value)}
                className="font-mono text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-threshold" className="font-mono text-[11px] uppercase tracking-wider text-dim">
                Memory (%)
              </Label>
              <Input
                id="mem-threshold"
                value={memoryThreshold}
                onChange={(e) => setMemoryThreshold(e.target.value)}
                className="font-mono text-[13px]"
              />
            </div>
          </div>
          <Button size="sm">Save Thresholds</Button>
        </div>
      </Card>

      {/* Notification Channels */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-4">Notifications</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Where to send alerts for this application.
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="slack-webhook" className="font-mono text-[11px] uppercase tracking-wider text-dim">
              Slack Webhook URL
            </Label>
            <Input id="slack-webhook" placeholder="https://hooks.slack.com/services/..." className="font-mono text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider text-dim">
              Email
            </Label>
            <Input id="email" placeholder="ops@gmac.io" className="font-mono text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pagerduty" className="font-mono text-[11px] uppercase tracking-wider text-dim">
              PagerDuty Integration Key
            </Label>
            <Input id="pagerduty" type="password" placeholder="Enter integration key..." className="font-mono text-[13px]" />
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-2">Route by severity</p>
            <div className="space-y-2 text-sm">
              {[
                { severity: "Critical", channels: "Slack, PagerDuty" },
                { severity: "Warning", channels: "Slack" },
                { severity: "Info", channels: "Email" },
              ].map((route) => (
                <div key={route.severity} className="flex items-center justify-between py-1">
                  <Badge
                    variant={route.severity === "Critical" ? "error" : route.severity === "Warning" ? "warning" : "secondary"}
                    className="font-mono text-[11px]"
                  >
                    {route.severity}
                  </Badge>
                  <span className="text-muted-foreground font-mono text-[11px]">{route.channels}</span>
                </div>
              ))}
            </div>
          </div>

          <Button size="sm">Save Notifications</Button>
        </div>
      </Card>

      {/* Environment Variables / Secrets */}
      <div>
        <h3 className="font-display text-sm font-semibold mb-3">Secrets & Environment Variables</h3>
        <SecretEditor applicationId={app?.id ?? appId} />
      </div>
    </div>
  );
}
