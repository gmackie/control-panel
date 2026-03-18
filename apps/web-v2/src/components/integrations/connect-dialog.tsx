"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROVIDER_LABELS } from "@/types/integration";
import type { IntegrationProvider } from "@/types/integration";

interface ConnectDialogProps {
  provider: IntegrationProvider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: (provider: string, token: string) => Promise<void>;
}

export function ConnectDialog({
  provider,
  open,
  onOpenChange,
  onConnect,
}: ConnectDialogProps) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "validating" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleConnect = async () => {
    if (!provider || !token.trim()) return;
    setStatus("validating");
    setError("");
    try {
      await onConnect?.(provider, token.trim());
      setStatus("success");
      setTimeout(() => {
        onOpenChange(false);
        setToken("");
        setStatus("idle");
      }, 1000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const label = provider ? PROVIDER_LABELS[provider] : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Connect {label}</DialogTitle>
          <DialogDescription>
            Enter your API token to connect {label}. The token will be validated
            before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="token">API Token / DSN</Label>
            <Input
              id="token"
              type="password"
              placeholder={`Enter ${label} API token...`}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setStatus("idle");
                setError("");
              }}
            />
          </div>

          {status === "success" && (
            <p className="text-sm text-green-500">Connected successfully. Discovering resources...</p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!token.trim() || status === "validating" || status === "success"}
          >
            {status === "validating" ? "Validating..." : status === "success" ? "Connected" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
