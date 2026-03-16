"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Heart,
  Rocket,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function CIStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        No runs
      </Badge>
    );
  }

  switch (status) {
    case "success":
      return (
        <Badge variant="success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case "failure":
      return (
        <Badge variant="error">
          <XCircle className="h-3 w-3 mr-1" />
          Failure
        </Badge>
      );
    case "running":
    case "waiting":
      return (
        <Badge variant="warning">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

function SyncStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Unknown
      </Badge>
    );
  }

  switch (status) {
    case "Synced":
      return (
        <Badge variant="success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Synced
        </Badge>
      );
    case "OutOfSync":
      return (
        <Badge variant="warning">
          <AlertTriangle className="h-3 w-3 mr-1" />
          OutOfSync
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

function HealthStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <Badge variant="secondary">
        <Heart className="h-3 w-3 mr-1" />
        Unknown
      </Badge>
    );
  }

  switch (status) {
    case "Healthy":
      return (
        <Badge variant="success">
          <Heart className="h-3 w-3 mr-1" />
          Healthy
        </Badge>
      );
    case "Degraded":
      return (
        <Badge variant="error">
          <Heart className="h-3 w-3 mr-1" />
          Degraded
        </Badge>
      );
    case "Progressing":
      return (
        <Badge variant="warning">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Progressing
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Heart className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

function SkeletonCard() {
  return (
    <Card className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-stone-700 rounded w-1/3" />
        <div className="flex gap-2">
          <div className="h-5 bg-stone-700 rounded w-20" />
          <div className="h-5 bg-stone-700 rounded w-20" />
          <div className="h-5 bg-stone-700 rounded w-20" />
        </div>
        <div className="h-4 bg-stone-700 rounded w-2/3" />
        <div className="h-4 bg-stone-700 rounded w-1/4" />
      </div>
    </Card>
  );
}

export function AppOverviewCards() {
  const { data, isLoading, error, refetch, isFetching } =
    trpc.appOverview.list.useQuery(undefined, {
      refetchInterval: 30000,
    });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <XCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-muted-foreground">
            Failed to load app overview: {error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const apps = data || [];

  if (apps.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <Rocket className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No pilot apps configured yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Pilot Applications
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <Card key={app.slug} className="p-5 space-y-4">
            {/* App name + repo link */}
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-base">{app.name}</h4>
              <a
                href={app.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* Status badges row */}
            <div className="flex flex-wrap gap-2">
              <CIStatusBadge status={app.ci?.status} />
              <SyncStatusBadge status={app.deploy?.syncStatus} />
              <HealthStatusBadge status={app.deploy?.healthStatus} />
            </div>

            {/* CI details */}
            {app.ci && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-mono text-xs">
                    {app.ci.commitSha}
                  </span>
                  <span className="truncate text-xs">
                    {app.ci.title}
                  </span>
                </div>
                {app.ci.startedAt && (
                  <p className="text-xs text-muted-foreground pl-5">
                    {formatDistanceToNow(new Date(app.ci.startedAt), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Deploy revision */}
            {app.deploy?.revision && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Rocket className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs">Deployed:</span>
                <span className="font-mono text-xs">
                  {app.deploy.revision}
                </span>
              </div>
            )}

            {/* No deploy data fallback */}
            {!app.ci && !app.deploy && (
              <p className="text-xs text-muted-foreground">
                No CI or deployment data available.
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
