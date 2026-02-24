"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useAppImages } from "@/hooks/use-app-data";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function RegistryTab({ appId }: { appId: string }) {
  const { data: app } = trpc.applications.bySlug.useQuery(appId);

  // Derive Harbor project and repo from app metadata
  // Convention: project = "library", repo = app slug
  const harborProject = "library";
  const harborRepo = app?.slug || appId;

  const { data: artifacts, isLoading, error } = useAppImages(
    harborProject,
    harborRepo
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Container Images</h3>
        <p className="text-sm text-muted-foreground">
          Could not fetch images from Harbor. The repository{" "}
          <code className="bg-muted/30 px-1 rounded text-xs">
            {harborProject}/{harborRepo}
          </code>{" "}
          may not exist yet.
        </p>
      </Card>
    );
  }

  if (!artifacts?.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Container Images</h3>
        <p className="text-sm text-muted-foreground">
          No container images found in{" "}
          <code className="bg-muted/30 px-1 rounded text-xs">
            {harborProject}/{harborRepo}
          </code>
          .
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Container Images ({artifacts.length})
        </h3>
        <span className="text-xs text-muted-foreground">
          {harborProject}/{harborRepo}
        </span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium px-4 py-2">Tags</th>
              <th className="text-left font-medium px-4 py-2">Digest</th>
              <th className="text-left font-medium px-4 py-2">Size</th>
              <th className="text-left font-medium px-4 py-2">Pushed</th>
              <th className="text-left font-medium px-4 py-2">
                Vulnerabilities
              </th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((artifact) => (
              <tr
                key={artifact.digest}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {artifact.tags.length > 0 ? (
                      artifact.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={tag === "latest" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        untagged
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <code className="text-xs text-muted-foreground">
                    {artifact.shortDigest}
                  </code>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {formatBytes(artifact.size)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {artifact.pushedAt
                    ? formatDistanceToNow(new Date(artifact.pushedAt), {
                        addSuffix: true,
                      })
                    : "\u2014"}
                </td>
                <td className="px-4 py-2.5">
                  {artifact.vulnerabilities ? (
                    <div className="flex items-center gap-1.5">
                      {artifact.vulnerabilities.critical > 0 && (
                        <Badge variant="error" className="text-xs">
                          C: {artifact.vulnerabilities.critical}
                        </Badge>
                      )}
                      {artifact.vulnerabilities.high > 0 && (
                        <Badge
                          className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20"
                        >
                          H: {artifact.vulnerabilities.high}
                        </Badge>
                      )}
                      {artifact.vulnerabilities.medium > 0 && (
                        <Badge variant="warning" className="text-xs">
                          M: {artifact.vulnerabilities.medium}
                        </Badge>
                      )}
                      {artifact.vulnerabilities.total === 0 && (
                        <Badge variant="success" className="text-xs">
                          Clean
                        </Badge>
                      )}
                    </div>
                  ) : artifact.scanStatus ? (
                    <span className="text-xs text-muted-foreground capitalize">
                      {artifact.scanStatus}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Not scanned
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
