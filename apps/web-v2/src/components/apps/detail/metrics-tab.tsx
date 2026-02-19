export function MetricsTab({ appId }: { appId: string }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Metrics</h3>
      <p className="text-muted-foreground">Prometheus charts for {appId} — CPU, memory, latency, errors.</p>
    </div>
  );
}
