"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { AppCard } from "@/components/apps/app-card";
import { AppSlideOver } from "@/components/apps/app-slide-over";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { AppSummary } from "@/types/app";

export default function AppsGrid() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppSummary | null>(null);

  // Fetch apps from tRPC — uses the existing applications router
  const { data: apps, isLoading } = trpc.applications.list.useQuery(undefined, {
    enabled: !!session,
  });

  // Transform DB apps into AppSummary format
  // This is a temporary mapper — in Task 11 we'll create a dedicated
  // tRPC procedure that returns the enriched AppSummary with K8s/Vercel status
  const appSummaries: AppSummary[] = (apps ?? []).map((app: any) => ({
    id: app.id,
    name: app.name,
    slug: app.slug ?? app.id,
    gitProvider: (app.gitProvider as any) ?? "gitea",
    deployProviders: [app.deployProvider ?? "k8s"].filter(Boolean) as any[],
    branch: app.defaultBranch ?? "main",
    latestCommit: app.latestCommitSha
      ? { sha: app.latestCommitSha, message: app.latestCommitMessage ?? "", timestamp: app.updatedAt ?? new Date().toISOString() }
      : undefined,
    environments: [],
    status: (app.status as any) ?? "unknown",
  }));

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
