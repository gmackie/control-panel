"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  RefreshCw,
  Check,
  Settings,
  Trash2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface OrgIntegration {
  id: string;
  provider: string;
  name: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown> | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderConfig {
  name: string;
  icon: string;
  description: string;
  docsUrl?: string;
  fields: { key: string; label: string; type: string; placeholder: string; secret?: boolean }[];
  configFields?: { key: string; label: string; type: string; placeholder: string }[];
}

const PROVIDERS: Record<string, ProviderConfig> = {
  vercel: {
    name: "Vercel",
    icon: "▲",
    description: "Deploy and host web applications",
    docsUrl: "https://vercel.com/docs/rest-api",
    fields: [
      { key: "token", label: "API Token", type: "password", placeholder: "Bearer token from Vercel", secret: true },
    ],
    configFields: [
      { key: "teamId", label: "Team ID (optional)", type: "text", placeholder: "team_xxx" },
    ],
  },
  expo: {
    name: "Expo",
    icon: "📱",
    description: "Build and deploy React Native apps",
    docsUrl: "https://docs.expo.dev/",
    fields: [
      { key: "token", label: "Access Token", type: "password", placeholder: "Expo access token", secret: true },
    ],
    configFields: [
      { key: "username", label: "Username (optional)", type: "text", placeholder: "@username" },
    ],
  },
  neon: {
    name: "Neon",
    icon: "🐘",
    description: "Serverless Postgres with branching",
    docsUrl: "https://neon.tech/docs",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Neon API key", secret: true },
    ],
  },
  turso: {
    name: "Turso",
    icon: "🗄️",
    description: "Edge SQLite with global replication",
    docsUrl: "https://docs.turso.tech/",
    fields: [
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Turso platform API token", secret: true },
    ],
    configFields: [
      { key: "organization", label: "Organization (optional)", type: "text", placeholder: "my-org" },
    ],
  },
  github: {
    name: "GitHub",
    icon: "🐙",
    description: "Source code hosting and CI/CD",
    docsUrl: "https://docs.github.com/en/rest",
    fields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "ghp_xxx", secret: true },
    ],
    configFields: [
      { key: "org", label: "Organization (optional)", type: "text", placeholder: "my-org" },
    ],
  },
  gitea: {
    name: "Gitea",
    icon: "🍵",
    description: "Self-hosted Git service",
    docsUrl: "https://docs.gitea.com/",
    fields: [
      { key: "token", label: "API Token", type: "password", placeholder: "Gitea access token", secret: true },
      { key: "url", label: "Gitea URL", type: "text", placeholder: "https://git.example.com" },
    ],
  },
  hetzner: {
    name: "Hetzner Cloud",
    icon: "☁️",
    description: "Cloud servers, volumes, and networking",
    docsUrl: "https://docs.hetzner.cloud/",
    fields: [
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Hetzner Cloud API token", secret: true },
    ],
    configFields: [
      { key: "defaultLocation", label: "Default Location (optional)", type: "text", placeholder: "fsn1, nbg1, hel1, ash, hil" },
    ],
  },
  aws: {
    name: "Amazon Web Services",
    icon: "🔶",
    description: "Lambda, S3, SQS, SNS, IoT, and more",
    docsUrl: "https://docs.aws.amazon.com/",
    fields: [
      { key: "awsExport", label: "Paste AWS Export Commands", type: "textarea", placeholder: "export AWS_ACCESS_KEY_ID=\"...\"\nexport AWS_SECRET_ACCESS_KEY=\"...\"\nexport AWS_SESSION_TOKEN=\"...\"", secret: false },
    ],
    configFields: [
      { key: "region", label: "Default Region", type: "text", placeholder: "us-east-1" },
    ],
  },
};

export default function IntegrationHubPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery<OrgIntegration[]>({
    queryKey: ["org-integrations"],
    queryFn: async () => {
      const response = await fetch("/api/integrations/org");
      if (!response.ok) throw new Error("Failed to fetch integrations");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { provider: string; name: string; credentials: Record<string, string>; config?: Record<string, string> }) => {
      const response = await fetch("/api/integrations/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create integration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
      setShowAddModal(false);
      setSelectedProvider(null);
      setFormData({});
      setTestResult(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/integrations/org/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete integration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingId(id);
      const response = await fetch(`/api/integrations/org/${id}/sync`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
    },
    onSettled: () => {
      setSyncingId(null);
    },
  });

  const parseAWSExportCommands = (exportText: string): Record<string, string> => {
    const credentials: Record<string, string> = {};
    const lines = exportText.split('\n');
    
    for (const line of lines) {
      const match = line.match(/export\s+(AWS_\w+)=["']?([^"'\n]+)["']?/);
      if (match) {
        const [, key, value] = match;
        if (key === 'AWS_ACCESS_KEY_ID') credentials.accessKeyId = value;
        else if (key === 'AWS_SECRET_ACCESS_KEY') credentials.secretAccessKey = value;
        else if (key === 'AWS_SESSION_TOKEN') credentials.sessionToken = value;
      }
    }
    
    return credentials;
  };

  const handleAddIntegration = () => {
    if (!selectedProvider) return;
    const provider = PROVIDERS[selectedProvider];

    let credentials: Record<string, string> = {};
    const config: Record<string, string> = {};

    if (selectedProvider === 'aws' && formData.awsExport) {
      credentials = parseAWSExportCommands(formData.awsExport);
    } else {
      provider.fields.forEach(field => {
        if (formData[field.key]) {
          credentials[field.key] = formData[field.key];
        }
      });
    }

    provider.configFields?.forEach(field => {
      if (formData[field.key]) {
        config[field.key] = formData[field.key];
      }
    });

    createMutation.mutate({
      provider: selectedProvider,
      name: formData.name || provider.name,
      credentials,
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    const provider = PROVIDERS[selectedProvider];

    let credentials: Record<string, string> = {};
    const config: Record<string, string> = {};

    if (selectedProvider === 'aws' && formData.awsExport) {
      credentials = parseAWSExportCommands(formData.awsExport);
    } else {
      provider.fields.forEach(field => {
        if (formData[field.key]) {
          credentials[field.key] = formData[field.key];
        }
      });
    }

    provider.configFields?.forEach(field => {
      if (formData[field.key]) {
        config[field.key] = formData[field.key];
      }
    });

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/integrations/org/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, credentials, config }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTestResult({ success: false, message: data.error || "Connection failed" });
      } else {
        setTestResult({ success: true, message: data.message || "Connection successful" });
      }
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderInfo = (provider: string) => PROVIDERS[provider] || { name: provider, icon: "🔌", description: "" };

  const connectedCount = integrations?.filter(i => i.enabled).length || 0;
  const totalProviders = Object.keys(PROVIDERS).length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Integration Hub</h1>
            <p className="mt-2 text-muted-foreground">
              Connect and manage your third-party services
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Connected Services</h2>
              <p className="text-sm text-muted-foreground">
                {connectedCount} integration{connectedCount !== 1 ? "s" : ""} active
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-lg border border-border">
                  <div className="animate-pulse flex items-center gap-4">
                    <div className="h-12 w-12 bg-muted rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-muted rounded w-1/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : integrations && integrations.length > 0 ? (
            <div className="space-y-3">
              {integrations.map((integration) => {
                const providerInfo = getProviderInfo(integration.provider);
                const isSyncing = syncingId === integration.id;

                return (
                  <div
                    key={integration.id}
                    className="p-4 rounded-lg border border-border hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center text-2xl">
                          {providerInfo.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{integration.name}</h3>
                            <Badge variant={integration.enabled ? "default" : "secondary"}>
                              {integration.enabled ? "Active" : "Disabled"}
                            </Badge>
                            {integration.lastSyncStatus === "success" && (
                              <Badge variant="outline" className="text-green-500 border-green-500/30">
                                <Check className="h-3 w-3 mr-1" />
                                Synced
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{providerInfo.description}</p>
                          {integration.lastSyncAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                            </p>
                          )}
                          {integration.lastSyncError && (
                            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {integration.lastSyncError}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {providerInfo.docsUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={providerInfo.docsUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncMutation.mutate(integration.id)}
                          disabled={isSyncing}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                          {isSyncing ? "Syncing..." : "Sync"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this integration? This cannot be undone.")) {
                              deleteMutation.mutate(integration.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No integrations configured</h3>
              <p className="text-muted-foreground mb-6">
                Connect your external services to get started
              </p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Integration
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Available Integrations</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {totalProviders} integrations available to connect
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(PROVIDERS).map(([key, provider]) => {
              const connectedCount = integrations?.filter(i => i.provider === key && i.enabled).length || 0;
              const isConnected = connectedCount > 0;
              const supportsMultiple = key === 'hetzner';
              return (
                <div
                  key={key}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    isConnected
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border hover:border-border/80 hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    if (!isConnected || supportsMultiple) {
                      setSelectedProvider(key);
                      setShowAddModal(true);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xl ${
                      isConnected ? "bg-green-500/20" : "bg-muted"
                    }`}>
                      {provider.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{provider.name}</p>
                        {isConnected && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        {supportsMultiple && connectedCount > 0 && (
                          <span className="text-xs text-muted-foreground">({connectedCount})</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {provider.description}
                        {supportsMultiple && " (supports multiple)"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false);
          setSelectedProvider(null);
          setFormData({});
          setTestResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl">
              {selectedProvider ? `Connect ${PROVIDERS[selectedProvider]?.name}` : "Add Integration"}
            </DialogTitle>
            <DialogDescription>
              {selectedProvider
                ? "Enter your credentials to connect this service"
                : "Select a service to connect to your organization"}
            </DialogDescription>
          </DialogHeader>

          {!selectedProvider ? (
            <div className="grid grid-cols-2 gap-3 pt-4">
              {Object.entries(PROVIDERS).map(([key, provider]) => {
                const connectedCount = integrations?.filter(i => i.provider === key && i.enabled).length || 0;
                const isConnected = connectedCount > 0;
                const supportsMultiple = key === 'hetzner';
                const isDisabled = isConnected && !supportsMultiple;
                return (
                  <button
                    key={key}
                    onClick={() => !isDisabled && setSelectedProvider(key)}
                    disabled={isDisabled}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      isDisabled
                        ? "border-green-500/30 bg-green-500/5 cursor-not-allowed opacity-60"
                        : isConnected && supportsMultiple
                        ? "border-green-500/30 bg-green-500/5 hover:border-primary hover:bg-accent/50"
                        : "border-border hover:border-primary hover:bg-accent/50 hover:shadow-sm"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xl ${
                      isConnected ? "bg-green-500/20" : "bg-muted"
                    }`}>
                      {provider.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{provider.name}</p>
                        {isConnected && <Check className="h-4 w-4 text-green-500" />}
                        {supportsMultiple && connectedCount > 0 && (
                          <span className="text-xs text-muted-foreground">({connectedCount})</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center text-2xl shadow-sm">
                  {PROVIDERS[selectedProvider].icon}
                </div>
                <div>
                  <p className="font-semibold">{PROVIDERS[selectedProvider].name}</p>
                  <p className="text-sm text-muted-foreground">{PROVIDERS[selectedProvider].description}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    placeholder={PROVIDERS[selectedProvider].name}
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">A friendly name to identify this integration</p>
                </div>

                {PROVIDERS[selectedProvider].fields.map((field) => (
                  <div key={field.key} className="grid gap-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.key}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="font-mono text-sm min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="font-mono"
                      />
                    )}
                  </div>
                ))}

                {PROVIDERS[selectedProvider].configFields && PROVIDERS[selectedProvider].configFields.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground">Optional Configuration</p>
                    {PROVIDERS[selectedProvider].configFields?.map((field) => (
                      <div key={field.key} className="grid gap-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={formData[field.key] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${
                  testResult.success
                    ? "bg-green-500/10 border border-green-500/20 text-green-500"
                    : "bg-destructive/10 border border-destructive/20 text-destructive"
                }`}>
                  {testResult.success ? <Check className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                  <div>
                    <p className="font-medium">{testResult.success ? "Connection Successful" : "Connection Failed"}</p>
                    <p className="text-xs opacity-80 mt-0.5">{testResult.message}</p>
                  </div>
                </div>
              )}

              {createMutation.isError && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Failed to Save</p>
                    <p className="text-xs opacity-80 mt-0.5">{createMutation.error?.message || "Failed to connect integration"}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 pt-4">
            {selectedProvider ? (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSelectedProvider(null);
                    setFormData({});
                    setTestResult(null);
                  }}
                >
                  Back
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !PROVIDERS[selectedProvider].fields.every(f => formData[f.key])}
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : "Test Connection"}
                </Button>
                <Button
                  onClick={handleAddIntegration}
                  disabled={createMutation.isPending || !PROVIDERS[selectedProvider].fields.every(f => formData[f.key])}
                >
                  {createMutation.isPending ? "Connecting..." : "Connect"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
