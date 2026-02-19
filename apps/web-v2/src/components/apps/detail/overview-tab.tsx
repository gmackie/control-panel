export function OverviewTab({ appId }: { appId: string }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Overview</h3>
      <p className="text-muted-foreground">App overview for {appId} — deploy status, git info, health charts.</p>
    </div>
  );
}
