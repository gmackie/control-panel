export function LogsTab({ appId }: { appId: string }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Logs</h3>
      <p className="text-muted-foreground">Live log tail for {appId} — pod/container selector.</p>
    </div>
  );
}
