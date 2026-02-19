export function DeploymentsTab({ appId }: { appId: string }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Deployments</h3>
      <p className="text-muted-foreground">Deploy history for {appId} — trigger deploy, rollback, build logs.</p>
    </div>
  );
}
