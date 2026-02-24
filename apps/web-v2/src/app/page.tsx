"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { useClusterDeployments } from "@/hooks/use-cluster-data";
import { AppCard } from "@/components/apps/app-card";
import { AppSlideOver } from "@/components/apps/app-slide-over";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { AppSummary, AppStatus, GitProvider, DeployProvider, AppEnvironment } from "@/types/app";
import type { MultiClusterDeployment } from "@/types/k8s";

/** Map the health status from listWithHealth to AppStatus */
function mapHealthStatus(status: "critical" | "warning" | "healthy"): AppStatus {
  switch (status) {
    case "critical":
      return "unhealthy";
    case "warning":
      return "degraded";
    case "healthy":
      return "healthy";
    default:
      return "unknown";
  }
}

/** Normalise the git provider string from DB to the GitProvider union */
function mapGitProvider(provider: string | null | undefined): GitProvider {
  if (provider === "gitea" || provider === "github") return provider;
  return "github";
}

/** Normalise the deploy provider string from DB to the DeployProvider union */
function mapDeployProvider(provider: string | null | undefined): DeployProvider {
  if (provider === "kubernetes" || provider === "k8s") return "k8s";
  if (provider === "vercel") return "vercel";
  // Default: kubernetes-based deploys map to k8s
  return "k8s";
}

/** Find K8s deployments matching an app by name, slug, or labels */
function findK8sDeploymentsForApp(
  name: string,
  slug: string,
  deployments: MultiClusterDeployment[]
): MultiClusterDeployment[] {
  const nameLower = name.toLowerCase();
  const slugLower = slug.toLowerCase();

  return deployments.filter((dep) => {
    const depName = dep.name.toLowerCase();
    // Match by deployment name containing app name or slug
    if (depName === nameLower || depName === slugLower) return true;
    if (depName.startsWith(`${slugLower}-`) || depName.startsWith(`${nameLower}-`)) return true;
    // Match by app label
    const appLabel = dep.labels?.["app"] ?? dep.labels?.["app.kubernetes.io/name"];
    if (appLabel && (appLabel.toLowerCase() === nameLower || appLabel.toLowerCase() === slugLower)) return true;
    return false;
  });
}

export default function AppsGrid() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppSummary | null>(null);

  // Fetch apps with health/alert data from the enriched procedure
  const { data: apps, isLoading } = trpc.applications.listWithHealth.useQuery(undefined, {
    enabled: !!session,
  });

  // Fetch recent deployments to enrich environment status on the cards
  const { data: deployments } = trpc.deployments.list.useQuery(
    { limit: 50 },
    { enabled: !!session },
  );

  // Fetch real K8s deployments for pod counts
  const { data: k8sDeployments } = useClusterDeployments();

  // Group deployments by appId for fast lookup
  const deploymentsByApp = useMemo(() => {
    if (!deployments) return new Map<string, typeof deployments>();
    const map = new Map<string, typeof deployments>();
    for (const d of deployments) {
      const existing = map.get(d.appId) ?? [];
      existing.push(d);
      map.set(d.appId, existing);
    }
    return map;
  }, [deployments]);

  // Build AppSummary[] from the enriched health data + deployments + K8s data
  const appSummaries: AppSummary[] = useMemo(() => {
    // Map cluster IDs to environment names for matching
    const clusterToEnv: Record<string, string> = {
      production: "production",
      staging: "staging",
    };

    return (apps ?? []).map((app) => {
      const deployProvider = mapDeployProvider(app.deployProvider);

      // Build environments from the most recent deployment per environment
      const appDeployments = deploymentsByApp.get(app.id) ?? [];
      const envMap = new Map<string, (typeof appDeployments)[number]>();
      for (const d of appDeployments) {
        if (!envMap.has(d.environment)) {
          envMap.set(d.environment, d);
        }
      }

      // Find matching K8s deployments by app name/slug
      const appK8s = findK8sDeploymentsForApp(
        app.name,
        app.slug ?? app.id,
        k8sDeployments ?? []
      );

      const environments: AppEnvironment[] = Array.from(envMap.entries()).map(
        ([envName, d]) => {
          const envStatus: AppStatus =
            d.status === "succeeded"
              ? "healthy"
              : d.status === "failed"
                ? "unhealthy"
                : d.status === "running"
                  ? "degraded"
                  : "unknown";

          // Find matching K8s deployment for this environment
          const k8sDep = appK8s.find(
            (dep) => clusterToEnv[dep.clusterId] === envName
          );

          return {
            name: envName,
            provider: deployProvider,
            status: envStatus,
            podCount: k8sDep
              ? { ready: k8sDep.readyReplicas, total: k8sDep.replicas }
              : undefined,
            version: d.version,
            lastDeployedAt: d.completedAt ?? d.startedAt,
          };
        },
      );

      // If we have K8s deployments for envs not yet in the map, add them
      for (const dep of appK8s) {
        const envName = clusterToEnv[dep.clusterId] ?? dep.clusterId;
        if (!envMap.has(envName)) {
          environments.push({
            name: envName,
            provider: "k8s",
            status: dep.readyReplicas === dep.replicas && dep.replicas > 0
              ? "healthy"
              : dep.readyReplicas > 0
                ? "degraded"
                : "unhealthy",
            podCount: { ready: dep.readyReplicas, total: dep.replicas },
          });
        }
      }

      let status = mapHealthStatus(app.status);
      if (app.isDeploying) {
        status = "degraded";
      }

      return {
        id: app.id,
        name: app.name,
        slug: app.slug ?? app.id,
        gitProvider: mapGitProvider(app.gitProvider),
        deployProviders: [deployProvider],
        branch: "main",
        latestCommit: undefined,
        environments,
        status,
      } satisfies AppSummary;
    });
  }, [apps, deploymentsByApp, k8sDeployments]);

  const filtered = appSummaries.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleClose = useCallback(() => setSelectedApp(null), []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {appSummaries.length} apps across your infrastructure
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {search ? "No apps match your search." : "No applications found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
          ))}
        </div>
      )}

      {/* Slide-over */}
      <AppSlideOver app={selectedApp} onClose={handleClose} />
    </div>
  );
}
