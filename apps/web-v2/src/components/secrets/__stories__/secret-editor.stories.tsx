import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, Trash2, Plus, Copy } from "lucide-react";
import { SyncStatusBanner } from "../sync-status-banner";

const meta: Meta = {
  title: "Secrets/SecretEditor",
};

export default meta;
type Story = StoryObj;

const mockSecrets = [
  {
    category: "Database",
    secrets: [
      { id: "1", key: "DATABASE_URL", maskedValue: "post****tech", status: "synced" },
      { id: "2", key: "DATABASE_POOL_URL", maskedValue: "post****6543", status: "synced" },
    ],
  },
  {
    category: "Authentication",
    secrets: [
      { id: "3", key: "BETTER_AUTH_SECRET", maskedValue: "sk_l****_abc", status: "synced" },
      { id: "4", key: "BETTER_AUTH_URL", maskedValue: "https://myapp.com", status: "synced" },
      { id: "5", key: "AUTH_GITHUB_CLIENT_ID", maskedValue: "Iv1.****d4e5", status: "drift" },
      { id: "6", key: "AUTH_GITHUB_CLIENT_SECRET", maskedValue: "ghse****789a", status: "synced" },
    ],
  },
  {
    category: "Monitoring",
    secrets: [
      { id: "7", key: "SENTRY_DSN", maskedValue: "http****o/456", status: "synced" },
      { id: "8", key: "POSTHOG_API_KEY", maskedValue: "Not set", status: "pending" },
    ],
  },
  {
    category: "Custom",
    secrets: [
      { id: "9", key: "MY_CUSTOM_VAR", maskedValue: "some-value", status: "synced" },
    ],
  },
];

const syncDotColor: Record<string, string> = {
  synced: "bg-green-500",
  pending: "bg-yellow-500",
  failed: "bg-red-500",
  drift: "bg-secondary",
};

export const Default: Story = {
  render: () => (
    <div className="space-y-4 max-w-2xl">
      <SyncStatusBanner total={9} synced={7} pending={1} failed={0} drift={1} />

      {mockSecrets.map((group) => (
        <Card key={group.category} className="p-4">
          <h4 className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">
            {group.category}
          </h4>
          <div className="space-y-1.5">
            {group.secrets.map((secret) => (
              <div key={secret.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn("h-2 w-2 rounded-full shrink-0", syncDotColor[secret.status])} />
                  <span className="font-mono text-[13px] font-medium shrink-0">{secret.key}</span>
                  <span className="font-mono text-[13px] text-muted-foreground truncate">{secret.maskedValue}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {secret.status === "drift" && <Badge variant="warning" className="font-mono text-[10px] mr-1">drift</Badge>}
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><span className="text-xs">Edit</span></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs mt-2">
            <Plus className="h-3 w-3 mr-1" /> Add Secret
          </Button>
        </Card>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" className="text-xs"><Copy className="h-3 w-3 mr-1" /> Copy as .env</Button>
        <Button variant="ghost" size="sm" className="text-xs"><Plus className="h-3 w-3 mr-1" /> Add Secret</Button>
      </div>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <Card className="p-6 text-center max-w-2xl">
      <p className="text-sm text-muted-foreground mb-3">No secrets configured for this application yet.</p>
      <Button size="sm"><Plus className="h-3 w-3 mr-1" /> Add First Secret</Button>
    </Card>
  ),
};

export const AllSynced: Story = {
  render: () => (
    <div className="max-w-2xl">
      <SyncStatusBanner total={5} synced={5} pending={0} failed={0} drift={0} />
    </div>
  ),
};

export const WithFailures: Story = {
  render: () => (
    <div className="max-w-2xl">
      <SyncStatusBanner total={8} synced={5} pending={0} failed={2} drift={1} />
    </div>
  ),
};
