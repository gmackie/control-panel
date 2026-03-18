import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ConnectDialog } from "../connect-dialog";
import { Button } from "@/components/ui/button";
import type { IntegrationProvider } from "@/types/integration";

const meta: Meta = {
  title: "Integrations/ConnectDialog",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [provider, setProvider] = useState<IntegrationProvider | null>(null);
    return (
      <>
        <div className="flex gap-2">
          <Button onClick={() => setProvider("sentry")}>Connect Sentry</Button>
          <Button variant="outline" onClick={() => setProvider("posthog")}>Connect PostHog</Button>
        </div>
        <ConnectDialog
          provider={provider}
          open={provider !== null}
          onOpenChange={(open) => { if (!open) setProvider(null); }}
          onConnect={async (p, token) => {
            await new Promise((r) => setTimeout(r, 1500));
            if (token === "fail") throw new Error("Invalid API token");
          }}
        />
      </>
    );
  },
};
