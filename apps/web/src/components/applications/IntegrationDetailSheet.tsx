"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Trash2,
  ExternalLink,
  Activity,
  Clock,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { INTEGRATION_TEMPLATES, ApplicationIntegration } from "@/types/applications";

interface IntegrationDetailSheetProps {
  applicationId: string;
  integration: ApplicationIntegration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlinked?: () => void;
}

interface IntegrationMetrics {
  requestsToday: number;
  requestsThisMonth: number;
  avgResponseTime: number;
  errorRate: number;
  lastChecked: string;
}

export function IntegrationDetailSheet({
  applicationId,
  integration,
  open,
  onOpenChange,
  onUnlinked,
}: IntegrationDetailSheetProps) {
  const queryClient = useQueryClient();
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);

  const template = integration
    ? INTEGRATION_TEMPLATES[integration.provider as keyof typeof INTEGRATION_TEMPLATES]
    : null;

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<IntegrationMetrics>({
    queryKey: ["integration-metrics", applicationId, integration?.id],
    queryFn: async () => {
      if (!integration) throw new Error("No integration");
      const response = await fetch(
        `/api/applications/${applicationId}/integrations/${integration.id}/metrics`
      );
      if (!response.ok) {
        return {
          requestsToday: 0,
          requestsThisMonth: 0,
          avgResponseTime: 0,
          errorRate: 0,
          lastChecked: new Date().toISOString(),
        };
      }
      return response.json();
    },
    enabled: !!integration && open,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!integration) throw new Error("No integration");
      const response = await fetch(
        `/api/applications/${applicationId}/integrations/${integration.id}/sync`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Failed to sync");
      return response.json();
    },
    onSuccess: () => {
      refetchMetrics();
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      if (!integration) throw new Error("No integration");
      const response = await fetch(
        `/api/applications/${applicationId}/integrations/${integration.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to unlink");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      setShowUnlinkDialog(false);
      onOpenChange(false);
      onUnlinked?.();
    },
  });

  if (!integration || !template) {
    return null;
  }

  const getStatusBadge = () => {
    switch (integration.status) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{template.icon}</span>
              <div>
                <SheetTitle>{template.name}</SheetTitle>
                <SheetDescription>{template.description}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              {getStatusBadge()}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card className="p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Usage Metrics
              </h4>
              {metricsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : metrics ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">Today</p>
                    <p className="text-lg font-semibold">
                      {metrics.requestsToday.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">This Month</p>
                    <p className="text-lg font-semibold">
                      {metrics.requestsThisMonth.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Avg Response</p>
                    <p className="text-lg font-semibold">{metrics.avgResponseTime}ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Error Rate</p>
                    <p className="text-lg font-semibold">{metrics.errorRate.toFixed(2)}%</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No metrics available</p>
              )}
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-3">Configuration</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Provider</span>
                  <span className="font-medium">{integration.provider}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Enabled</span>
                  <span className="font-medium">{integration.enabled ? "Yes" : "No"}</span>
                </div>
                {integration.lastSyncAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Last Synced</span>
                    <span className="font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(integration.lastSyncAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Linked Secrets</span>
                  <span className="font-medium">{integration.secrets.length}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-3">Features</h4>
              <div className="flex flex-wrap gap-2">
                {template.features.map((feature) => (
                  <Badge key={feature} variant="outline">
                    {feature}
                  </Badge>
                ))}
              </div>
            </Card>

            {integration.webhooks && integration.webhooks.length > 0 && (
              <Card className="p-4">
                <h4 className="font-medium mb-3">Webhooks</h4>
                <div className="space-y-2">
                  {integration.webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <code className="text-xs bg-zinc-900 px-2 py-1 rounded truncate max-w-[200px]">
                        {webhook.url}
                      </code>
                      <Badge variant={webhook.isActive ? "default" : "secondary"}>
                        {webhook.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Separator />

            <div className="space-y-2">
              <a
                href={`https://${integration.provider}.com`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open {template.name} Dashboard
                </Button>
              </a>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowUnlinkDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Unlink Integration
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Unlink {template.name}?
            </DialogTitle>
            <DialogDescription>
              This will remove the integration from your application. The linked secrets
              will remain but will no longer be associated with this integration.
              You can reconnect this integration later, but you may need to reconfigure
              settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUnlinkDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
