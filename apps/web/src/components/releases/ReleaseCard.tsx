"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tag,
  GitBranch,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Rocket,
  ExternalLink,
  ChevronRight,
  FileText,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

export type ReleaseStatus = "draft" | "ready" | "published" | "deployed";

export interface Release {
  id: string;
  applicationId: string;
  version: string;
  name: string | null;
  description: string | null;
  changelog: string | null;
  status: ReleaseStatus;
  targetBranch: string | null;
  commitSha: string | null;
  tagName: string | null;
  isPrerelease: boolean;
  deployedEnvironments: string[];
  githubRelease: { published: boolean; url: string } | null;
  giteaRelease: { published: boolean; url: string } | null;
  createdBy: string | null;
  publishedBy: string | null;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  linkedTasks?: { id: string; title: string; status: string }[];
}

interface ReleaseCardProps {
  release: Release;
  onClick?: () => void;
  variant?: "default" | "compact";
}

const statusConfig: Record<
  ReleaseStatus,
  { color: string; icon: typeof CheckCircle; label: string }
> = {
  draft: {
    color: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    icon: FileText,
    label: "Draft",
  },
  ready: {
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Clock,
    label: "Ready",
  },
  published: {
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: CheckCircle,
    label: "Published",
  },
  deployed: {
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: Rocket,
    label: "Deployed",
  },
};

export function ReleaseCard({
  release,
  onClick,
  variant = "default",
}: ReleaseCardProps) {
  const statusInfo = statusConfig[release.status] || statusConfig.draft;
  const StatusIcon = statusInfo.icon;

  const publishedDate = release.publishedAt
    ? typeof release.publishedAt === "string"
      ? new Date(release.publishedAt)
      : release.publishedAt
    : null;

  const createdDate =
    typeof release.createdAt === "string"
      ? new Date(release.createdAt)
      : release.createdAt;

  if (variant === "compact") {
    return (
      <Card
        className={cn(
          "p-3 bg-gray-900 border-gray-800 hover:border-gray-700 cursor-pointer transition-all group",
          "hover:bg-gray-800/50"
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-500" />
              <span className="font-mono font-semibold text-gray-100">
                v{release.version}
              </span>
            </div>
            {release.name && (
              <span className="text-sm text-gray-400 truncate">
                {release.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
            {release.isPrerelease && (
              <Badge
                variant="outline"
                className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
              >
                Pre-release
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "p-4 bg-gray-900 border-gray-800 hover:border-gray-700 cursor-pointer transition-all group",
        "hover:bg-gray-800/50"
      )}
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/30 rounded-lg">
              <Tag className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold text-gray-100">
                  v{release.version}
                </span>
                {release.isPrerelease && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  >
                    Pre-release
                  </Badge>
                )}
              </div>
              {release.name && (
                <p className="text-sm text-gray-400">{release.name}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>

        {release.description && (
          <p className="text-sm text-gray-400 line-clamp-2">
            {release.description}
          </p>
        )}

        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
          {release.targetBranch && (
            <div className="flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              <span>{release.targetBranch}</span>
            </div>
          )}
          {release.commitSha && (
            <div className="flex items-center gap-1">
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">
                {release.commitSha.slice(0, 7)}
              </code>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {publishedDate
                ? `Published ${formatDistanceToNow(publishedDate, { addSuffix: true })}`
                : `Created ${formatDistanceToNow(createdDate, { addSuffix: true })}`}
            </span>
          </div>
        </div>

        {(release.deployedEnvironments?.length > 0 ||
          release.githubRelease?.published ||
          release.giteaRelease?.published) && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
            {release.deployedEnvironments?.map((env) => (
              <Badge
                key={env}
                variant="secondary"
                className="text-xs bg-purple-500/10 text-purple-400"
              >
                <Rocket className="h-3 w-3 mr-1" />
                {env}
              </Badge>
            ))}
            {release.githubRelease?.published && (
              <a
                href={release.githubRelease.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
              >
                <ExternalLink className="h-3 w-3" />
                GitHub
              </a>
            )}
            {release.giteaRelease?.published && (
              <a
                href={release.giteaRelease.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
              >
                <ExternalLink className="h-3 w-3" />
                Gitea
              </a>
            )}
          </div>
        )}

        {release.linkedTasks && release.linkedTasks.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
            <span className="text-xs text-gray-500">
              {release.linkedTasks.length} linked task
              {release.linkedTasks.length !== 1 ? "s" : ""}
            </span>
            <div className="flex -space-x-1">
              {release.linkedTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium border-2 border-gray-900",
                    task.status === "done"
                      ? "bg-green-500/20 text-green-400"
                      : task.status === "in_progress"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-gray-700 text-gray-400"
                  )}
                  title={task.title}
                >
                  {task.status === "done" ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : task.status === "in_progress" ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ReleaseCardSkeleton({ variant = "default" }: { variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <Card className="p-3 bg-gray-900 border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="h-5 w-20 bg-gray-800 rounded animate-pulse" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gray-900 border-gray-800">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-800 rounded-lg animate-pulse" />
            <div className="space-y-1">
              <div className="h-5 w-20 bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="h-4 w-3/4 bg-gray-800 rounded animate-pulse" />
        <div className="flex items-center gap-4">
          <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
    </Card>
  );
}
