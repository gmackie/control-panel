"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ProviderGrid } from "@/components/integrations/provider-grid";
import { ConnectDialog } from "@/components/integrations/connect-dialog";
import { useIntegrations } from "@/hooks/use-integration-data";
import type { IntegrationProvider } from "@/types/integration";

export default function IntegrationsPage() {
  const { data: session } = useSession();
  const { data: integrations, isLoading } = useIntegrations();
  const [connectProvider, setConnectProvider] = useState<IntegrationProvider | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect and monitor third-party providers
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <ProviderGrid
          integrations={integrations ?? []}
          onConnect={(p) => setConnectProvider(p as IntegrationProvider)}
        />
      )}

      <ConnectDialog
        provider={connectProvider}
        open={connectProvider !== null}
        onOpenChange={(open) => {
          if (!open) setConnectProvider(null);
        }}
      />
    </div>
  );
}
