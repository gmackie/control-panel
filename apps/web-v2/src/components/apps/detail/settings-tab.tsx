export function SettingsTab({ appId }: { appId: string }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Settings</h3>
      <p className="text-muted-foreground">App settings for {appId} — env vars, secrets, git repo, webhooks.</p>
    </div>
  );
}
