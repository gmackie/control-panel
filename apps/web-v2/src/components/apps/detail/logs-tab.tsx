"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";

export function LogsTab({ appId }: { appId: string }) {
  const { data: app } = trpc.applications.bySlug.useQuery(appId);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Pod Logs</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Live log streaming for K8s pods will be available here via SSE.
        </p>
        {app?.deployProvider === "vercel" && (
          <p className="text-sm text-muted-foreground">
            For Vercel deployments, view logs in the{" "}
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Vercel Dashboard
            </a>
          </p>
        )}
        {app?.deployProvider === "kubernetes" && (
          <p className="text-sm text-muted-foreground">
            K8s pod log streaming coming soon. Pod selector and container
            selector will be available.
          </p>
        )}
      </Card>
    </div>
  );
}
