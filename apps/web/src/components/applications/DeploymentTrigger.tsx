"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "compact" | "default";

interface DeploymentTriggerProps {
  appId: string;
  appName?: string;
  currentCommit?: string;
  variant?: Variant;
  onDeploymentComplete?: (success: boolean) => void;
}

export function DeploymentTrigger({
  appId,
  variant = "default",
  onDeploymentComplete,
}: DeploymentTriggerProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerDeploy = async () => {
    setIsDeploying(true);
    setError(null);

    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/actions/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "production" }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        const message =
          payload?.message || payload?.error || `Failed to trigger deployment (${response.status})`;
        throw new Error(message);
      }

      onDeploymentComplete?.(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to trigger deployment";
      setError(message);
      onDeploymentComplete?.(false);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className={cn("flex flex-col", variant === "compact" ? "items-stretch" : "items-start")}> 
      <Button
        type="button"
        variant={variant === "compact" ? "outline" : "default"}
        size="sm"
        onClick={triggerDeploy}
        disabled={isDeploying}
        className={cn(variant === "compact" ? "h-8" : "")}
      >
        {isDeploying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className={cn("h-4 w-4", variant === "compact" ? "" : "mr-2")} />
        )}
        {variant === "compact" ? null : isDeploying ? "Deploying..." : "Deploy"}
      </Button>

      {variant !== "compact" && error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
