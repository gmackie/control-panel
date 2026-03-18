"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { HealthOverviewStrip } from "@/components/monitoring/health-overview-strip";
import { AlertTimeline } from "@/components/monitoring/alert-timeline";
import { AppHealthGrid } from "@/components/monitoring/app-health-grid";
import { useHealthMetrics, useAlertTimeline, useAppHealthGrid } from "@/hooks/use-monitoring-data";
import { trpc } from "@/lib/trpc/client";
import type { AppHealthItem } from "@/components/monitoring/app-health-grid";
import type { AlertEvent } from "@/components/monitoring/alert-timeline";

export default function MonitoringPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: metrics } = useHealthMetrics();
  const { data: alerts, isLoading: alertsLoading } = useAlertTimeline({ limit: 50 });
  const { data: appHealth, isLoading: appsLoading } = useAppHealthGrid();

  const acknowledgeAlert = trpc.monitoring.acknowledgeAlert.useMutation();

  const handleAppClick = (app: AppHealthItem) => {
    router.push(`/apps/${app.slug}?tab=observability`);
  };

  const handleAlertClick = (alert: AlertEvent) => {
    if (alert.app) {
      router.push(`/apps/${alert.app}?tab=observability`);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System-wide health, alerts, and application status
        </p>
      </div>

      {metrics && metrics.length > 0 && (
        <HealthOverviewStrip metrics={metrics} />
      )}

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Alerts</h2>
        {alertsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <AlertTimeline
            alerts={alerts ?? []}
            onAcknowledge={(id) => acknowledgeAlert.mutate({ alertId: id })}
            onAlertClick={handleAlertClick}
          />
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Application Health</h2>
        {appsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <AppHealthGrid
            apps={appHealth ?? []}
            onAppClick={handleAppClick}
          />
        )}
      </section>
    </div>
  );
}
