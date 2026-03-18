"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X, RotateCcw, Link2 } from "lucide-react";
import type { IntegrationResource, IntegrationCredential, IntegrationSummary } from "@/types/integration";
import { PROVIDER_LABELS } from "@/types/integration";

interface IntegrationDetailProps {
  integration: IntegrationSummary;
  resources: IntegrationResource[];
  credential: IntegrationCredential;
  onRotateToken?: () => void;
  onLinkResource?: (resourceId: string) => void;
  onClose?: () => void;
}

export function IntegrationDetail({
  integration,
  resources,
  credential,
  onRotateToken,
  onLinkResource,
  onClose,
}: IntegrationDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn("h-3 w-3 rounded-full", {
              "bg-green-500": integration.syncStatus === "synced",
              "bg-yellow-500": integration.syncStatus === "stale",
              "bg-red-500": integration.syncStatus === "error",
              "bg-neutral-400": integration.syncStatus === "never",
            })}
          />
          <h3 className="font-display text-lg font-semibold">
            {PROVIDER_LABELS[integration.provider]}
          </h3>
          <Badge variant="secondary" className="font-mono text-[11px]">
            {integration.syncStatus}
          </Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Credentials */}
      <Card className="p-4">
        <h4 className="font-display text-sm font-semibold mb-3">Credentials</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">API Token</span>
            <div className="flex items-center gap-2">
              {credential.hasToken ? (
                <span className="flex items-center gap-1 text-green-500 font-mono text-[13px]">
                  <Check className="h-3 w-3" /> Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 font-mono text-[13px]">
                  <X className="h-3 w-3" /> Missing
                </span>
              )}
              {onRotateToken && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRotateToken}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Rotate
                </Button>
              )}
            </div>
          </div>
          {credential.environments.map((env) => (
            <div key={env.name} className="flex items-center justify-between text-sm pl-4">
              <span className="text-muted-foreground capitalize">{env.name}</span>
              {env.configured ? (
                <span className="flex items-center gap-1 text-green-500 font-mono text-[11px]">
                  <Check className="h-3 w-3" /> Set
                </span>
              ) : (
                <span className="flex items-center gap-1 text-dim font-mono text-[11px]">
                  <X className="h-3 w-3" /> Not set
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Resources */}
      <Card className="p-4">
        <h4 className="font-display text-sm font-semibold mb-3">
          Resources ({resources.length})
        </h4>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resources discovered.</p>
        ) : (
          <div className="space-y-2">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{resource.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {resource.type}
                    {resource.environment && ` • ${resource.environment}`}
                    {resource.metadata &&
                      Object.entries(resource.metadata).map(([k, v]) => (
                        <span key={k}> • {v}</span>
                      ))}
                  </p>
                </div>
                <div>
                  {resource.linkedApp ? (
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {resource.linkedApp}
                    </Badge>
                  ) : onLinkResource ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onLinkResource(resource.id)}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Link
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
