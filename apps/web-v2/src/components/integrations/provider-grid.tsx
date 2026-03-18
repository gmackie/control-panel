"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { IntegrationSummary, IntegrationCategory } from "@/types/integration";
import { PROVIDER_CATEGORIES, PROVIDER_LABELS } from "@/types/integration";

interface ProviderGridProps {
  integrations: IntegrationSummary[];
  onConnect?: (provider: string) => void;
  onResync?: (provider: string) => void;
  onProviderClick?: (integration: IntegrationSummary) => void;
}

const syncDotColor = {
  synced: "bg-green-500",
  stale: "bg-yellow-500",
  error: "bg-red-500",
  never: "bg-neutral-400",
} as const;

const categoryLabels: Record<IntegrationCategory, string> = {
  infrastructure: "Infrastructure",
  source_control: "Source Control",
  databases: "Databases",
  services: "Services",
};

export function ProviderGrid({
  integrations,
  onConnect,
  onResync,
  onProviderClick,
}: ProviderGridProps) {
  const integrationMap = new Map(integrations.map((i) => [i.provider, i]));

  return (
    <div className="space-y-8">
      {(Object.entries(PROVIDER_CATEGORIES) as [IntegrationCategory, string[]][]).map(
        ([category, providers]) => {
          const categoryIntegrations = providers
            .map((p) => integrationMap.get(p as any))
            .filter(Boolean) as IntegrationSummary[];

          // Skip empty categories
          if (categoryIntegrations.length === 0 && providers.length === 0) return null;

          return (
            <section key={category}>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">
                {categoryLabels[category]}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {providers.map((provider) => {
                  const integration = integrationMap.get(provider as any);

                  return (
                    <Card
                      key={provider}
                      className={cn(
                        "p-4 transition-all",
                        integration?.connected
                          ? "hover:border-primary/30 cursor-pointer"
                          : "border-dashed",
                        onProviderClick && integration?.connected && "cursor-pointer"
                      )}
                      onClick={() =>
                        integration?.connected && onProviderClick?.(integration)
                      }
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              integration?.connected
                                ? syncDotColor[integration.syncStatus]
                                : "bg-neutral-400"
                            )}
                          />
                          <span className="font-display font-semibold text-sm">
                            {PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] ?? provider}
                          </span>
                        </div>
                      </div>

                      {integration?.connected ? (
                        <>
                          <p className="font-mono text-[13px] tabular-nums text-muted-foreground">
                            {integration.resourceCount} resource{integration.resourceCount !== 1 ? "s" : ""}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="font-mono text-[11px] text-dim">
                              Synced{" "}
                              {integration.lastSyncAt
                                ? formatDistanceToNow(new Date(integration.lastSyncAt), { addSuffix: true })
                                : "never"}
                            </p>
                            {onResync && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onResync(provider);
                                }}
                              >
                                Resync
                              </Button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConnect?.(provider);
                            }}
                          >
                            Connect
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        }
      )}
    </div>
  );
}
