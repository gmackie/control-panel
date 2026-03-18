"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Trash2, Plus, Copy, Download } from "lucide-react";
import { SyncStatusBanner } from "./sync-status-banner";

interface SecretEditorProps {
  applicationId: string;
  environment?: string;
}

const syncDotColor: Record<string, string> = {
  synced: "bg-green-500",
  pending: "bg-yellow-500",
  failed: "bg-red-500",
  drift: "bg-secondary",
};

export function SecretEditor({ applicationId, environment }: SecretEditorProps) {
  const utils = trpc.useUtils();
  const { data: groups, isLoading } = trpc.secrets.list.useQuery({ applicationId, environment });
  const { data: syncStatus } = trpc.secrets.syncStatus.useQuery(applicationId);
  const setSecret = trpc.secrets.set.useMutation({
    onSuccess: () => utils.secrets.list.invalidate(),
  });
  const deleteSecret = trpc.secrets.delete.useMutation({
    onSuccess: () => utils.secrets.list.invalidate(),
  });
  const exportSecrets = trpc.secrets.export.useQuery(
    { applicationId, environment, format: "dotenv" },
    { enabled: false }
  );

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // Reveal a secret value
  const { data: revealedData } = trpc.secrets.reveal.useQuery(revealedId!, {
    enabled: !!revealedId,
  });

  // Auto-hide reveal after 10s
  const handleReveal = useCallback((id: string) => {
    setRevealedId(id);
    setTimeout(() => setRevealedId(null), 10000);
  }, []);

  const handleSave = useCallback(async (id: string, key: string, category: string) => {
    if (!editValue.trim()) return;
    await setSecret.mutateAsync({
      applicationId,
      key,
      value: editValue,
      environment: environment ?? "shared",
      category: category as any,
    });
    setEditingId(null);
    setEditValue("");
  }, [applicationId, environment, editValue, setSecret]);

  const handleAdd = useCallback(async (category: string) => {
    if (!newKey.trim() || !newValue.trim()) return;
    await setSecret.mutateAsync({
      applicationId,
      key: newKey.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      value: newValue,
      environment: environment ?? "shared",
      category: category as any,
    });
    setAddingCategory(null);
    setNewKey("");
    setNewValue("");
  }, [applicationId, environment, newKey, newValue, setSecret]);

  const handleExport = useCallback(async () => {
    const result = await exportSecrets.refetch();
    if (result.data?.content) {
      await navigator.clipboard.writeText(result.data.content);
    }
  }, [exportSecrets]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync status banner */}
      {syncStatus && syncStatus.total > 0 && (
        <SyncStatusBanner
          total={syncStatus.total}
          synced={syncStatus.synced}
          pending={syncStatus.pending}
          failed={syncStatus.failed}
          drift={syncStatus.drift}
        />
      )}

      {/* Secret groups */}
      {(!groups || groups.length === 0) ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No secrets configured for this application yet.
          </p>
          <Button size="sm" onClick={() => setAddingCategory("custom")}>
            <Plus className="h-3 w-3 mr-1" /> Add First Secret
          </Button>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.category} className="p-4">
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">
              {group.label}
            </h4>
            <div className="space-y-1.5">
              {group.secrets.map((secret) => (
                <div
                  key={secret.id}
                  className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Sync status dot */}
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        syncDotColor[secret.lastSyncStatus ?? "pending"] ?? "bg-muted-foreground"
                      )}
                      title={secret.lastSyncStatus ?? "unknown"}
                    />

                    {/* Key name */}
                    <span className="font-mono text-[13px] font-medium shrink-0">
                      {secret.key}
                    </span>

                    {/* Value (masked or editing) */}
                    {editingId === secret.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="password"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 font-mono text-[13px] flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave(secret.id, secret.key, secret.category);
                            if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                          }}
                        />
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleSave(secret.id, secret.key, secret.category)}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingId(null); setEditValue(""); }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono text-[13px] text-muted-foreground truncate">
                        {revealedId === secret.id && revealedData?.value
                          ? revealedData.value
                          : secret.maskedValue}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== secret.id && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {secret.lastSyncStatus === "drift" && (
                        <Badge variant="warning" className="font-mono text-[10px] mr-1">drift</Badge>
                      )}
                      {secret.lastSyncStatus === "failed" && (
                        <Badge variant="error" className="font-mono text-[10px] mr-1">failed</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          if (revealedId === secret.id) {
                            setRevealedId(null);
                          } else {
                            handleReveal(secret.id);
                          }
                        }}
                        title={revealedId === secret.id ? "Hide" : "Reveal"}
                      >
                        {revealedId === secret.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(secret.id);
                          setEditValue("");
                        }}
                        title="Edit"
                      >
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={() => {
                          if (confirm(`Delete ${secret.key}?`)) {
                            deleteSecret.mutate(secret.id);
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add secret to this category */}
            {addingCategory === group.category ? (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <Input
                  placeholder="KEY_NAME"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                  className="h-7 font-mono text-[13px] w-40"
                  autoFocus
                />
                <Input
                  type="password"
                  placeholder="Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="h-7 font-mono text-[13px] flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd(group.category);
                  }}
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => handleAdd(group.category)}>
                  Add
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAddingCategory(null); setNewKey(""); setNewValue(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs mt-2"
                onClick={() => setAddingCategory(group.category)}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Secret
              </Button>
            )}
          </Card>
        ))
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" className="text-xs" onClick={handleExport}>
          <Copy className="h-3 w-3 mr-1" /> Copy as .env
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAddingCategory("custom")}>
          <Plus className="h-3 w-3 mr-1" /> Add Secret
        </Button>
      </div>
    </div>
  );
}
