"use client";

import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Account and configuration</p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{session?.user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{session?.user?.email ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider</span>
            <span>GitHub</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        <p className="text-sm text-muted-foreground">API key management will be wired here via tRPC.</p>
      </Card>
    </div>
  );
}
