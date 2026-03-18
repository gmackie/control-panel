"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import type { IntegrationSummary } from "@/types/integration";
import { PROVIDER_LABELS } from "@/types/integration";

/** Load all org-level integrations and map to IntegrationSummary */
export function useIntegrations() {
  const { data: orgIntegrations, ...rest } = trpc.integrations.listOrgIntegrations.useQuery(
    undefined,
    { refetchInterval: 60_000 }
  );

  const summaries = useMemo<IntegrationSummary[]>(() => {
    if (!orgIntegrations) return [];
    return orgIntegrations.map((org) => {
      const provider = org.provider as keyof typeof PROVIDER_LABELS;
      const category =
        ["kubernetes", "harbor"].includes(provider) ? "infrastructure" as const
        : ["gitea", "github"].includes(provider) ? "source_control" as const
        : ["turso", "neon"].includes(provider) ? "databases" as const
        : "services" as const;

      return {
        provider,
        category,
        displayName: PROVIDER_LABELS[provider] ?? org.name ?? provider,
        connected: org.enabled,
        resourceCount: 0, // TODO: join with resource count query
        syncStatus: org.lastSyncStatus === "success"
          ? "synced" as const
          : org.lastSyncStatus === "error"
            ? "error" as const
            : org.lastSyncAt
              ? "stale" as const
              : "never" as const,
        lastSyncAt: org.lastSyncAt ? new Date(org.lastSyncAt).toISOString() : undefined,
      };
    });
  }, [orgIntegrations]);

  return { data: summaries, ...rest };
}
