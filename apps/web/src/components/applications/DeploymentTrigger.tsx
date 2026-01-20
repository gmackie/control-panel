"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Rocket,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Server,
  GitCommit,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DeploymentEnvironment = "development" | "staging" | "production";

interface DeploymentStep {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  message?: string;
}

interface DeploymentTriggerProps {
  appId: string;
  appName?: string;
  currentCommit?: string;
  className?: string;
  variant?: "default" | "compact";
  onDeploymentComplete?: (success: boolean) => void;
}

const ENVIRONMENTS: Array<{ value: DeploymentEnvironment; label: string; color: string }> = [
  { value: "development", label: "Development", color: "bg-blue-600" },
  { value: "staging", label: "Staging", color: "bg-yellow-600" },
  { value: "production", label: "Production", color: "bg-red-600" },
];

const DEPLOYMENT_STEPS: DeploymentStep[] = [
  { id: "validate", name: "Validating configuration", status: "pending" },
  { id: "build", name: "Building image", status: "pending" },
  { id: "push", name: "Pushing to registry", status: "pending" },
  { id: "deploy", name: "Deploying to cluster", status: "pending" },
  { id: "health", name: "Running health checks", status: "pending" },
];

export function DeploymentTrigger({
  appId,
  appName,
  currentCommit,
  className,
  variant = "default",
  onDeploymentComplete,
}: DeploymentTriggerProps) {
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<DeploymentEnvironment | null>(null);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);

  const deployMutation = useMutation({
    mutationFn: async (environment: DeploymentEnvironment) => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/actions/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to deploy");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-deployments", appId] });
      queryClient.invalidateQueries({ queryKey: ["unified-app", appId] });
      onDeploymentComplete?.(true);
    },
    onError: () => {
      onDeploymentComplete?.(false);
    },
  });

  const simulateDeploymentProgress = async (environment: DeploymentEnvironment) => {
    setIsDeploying(true);
    setDeploymentSteps(DEPLOYMENT_STEPS.map(s => ({ ...s, status: "pending" })));

    for (let i = 0; i < DEPLOYMENT_STEPS.length; i++) {
      setDeploymentSteps(prev => 
        prev.map((step, idx) => ({
          ...step,
          status: idx === i ? "running" : idx < i ? "success" : "pending"
        }))
      );

      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

      if (i === DEPLOYMENT_STEPS.length - 1) {
        try {
          await deployMutation.mutateAsync(environment);
          setDeploymentSteps(prev =>
            prev.map(step => ({ ...step, status: "success" }))
          );
        } catch {
          setDeploymentSteps(prev =>
            prev.map((step, idx) => ({
              ...step,
              status: idx === i ? "failed" : idx < i ? "success" : "skipped"
            }))
          );
        }
      }
    }

    setTimeout(() => {
      setIsDeploying(false);
      setShowConfirmDialog(false);
      setSelectedEnvironment(null);
    }, 1500);
  };

  const handleDeployClick = (environment: DeploymentEnvironment) => {
    setSelectedEnvironment(environment);
    setShowConfirmDialog(true);
  };

  const handleConfirmDeploy = () => {
    if (selectedEnvironment) {
      simulateDeploymentProgress(selectedEnvironment);
    }
  };

  const getStepIcon = (status: DeploymentStep["status"]) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "skipped":
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-zinc-600" />;
    }
  };

  const completedSteps = deploymentSteps.filter(s => s.status === "success").length;
  const progress = (completedSteps / deploymentSteps.length) * 100;

  if (variant === "compact") {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className={className} disabled={deployMutation.isPending}>
              {deployMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-1" />
                  Deploy
                  <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Deploy to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ENVIRONMENTS.map((env) => (
              <DropdownMenuItem
                key={env.value}
                onClick={() => handleDeployClick(env.value)}
              >
                <Badge className={cn("mr-2", env.color)}>{env.label}</Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DeployConfirmDialog />
      </>
    );
  }

  function DeployConfirmDialog() {
    const envConfig = ENVIRONMENTS.find(e => e.value === selectedEnvironment);

    return (
      <Dialog open={showConfirmDialog} onOpenChange={(open) => !isDeploying && setShowConfirmDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              {isDeploying ? "Deploying..." : "Confirm Deployment"}
            </DialogTitle>
            <DialogDescription>
              {isDeploying
                ? `Deploying ${appName || appId} to ${selectedEnvironment}`
                : `You are about to deploy to ${selectedEnvironment}. This action will update the live application.`}
            </DialogDescription>
          </DialogHeader>

          {isDeploying ? (
            <div className="py-4 space-y-4">
              <Progress value={progress} className="h-2" />
              <div className="space-y-2">
                {deploymentSteps.map((step) => (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded",
                      step.status === "running" && "bg-blue-500/10",
                      step.status === "success" && "bg-green-500/10",
                      step.status === "failed" && "bg-red-500/10"
                    )}
                  >
                    {getStepIcon(step.status)}
                    <span className={cn(
                      "text-sm",
                      step.status === "pending" && "text-zinc-500",
                      step.status === "running" && "text-blue-400",
                      step.status === "success" && "text-green-400",
                      step.status === "failed" && "text-red-400"
                    )}>
                      {step.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm text-zinc-400">Environment</span>
                </div>
                {envConfig && (
                  <Badge className={envConfig.color}>{envConfig.label}</Badge>
                )}
              </div>
              
              {currentCommit && (
                <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm text-zinc-400">Commit</span>
                  </div>
                  <code className="text-sm font-mono">{currentCommit.slice(0, 7)}</code>
                </div>
              )}

              {selectedEnvironment === "production" && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
                  <p className="text-sm text-red-400">
                    This will deploy to production and affect live users.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isDeploying && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeploy}
                className={cn(envConfig?.color)}
              >
                <Rocket className="h-4 w-4 mr-2" />
                Deploy to {envConfig?.label}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {ENVIRONMENTS.map((env) => (
          <Button
            key={env.value}
            variant={env.value === "production" ? "default" : "outline"}
            size="sm"
            onClick={() => handleDeployClick(env.value)}
            disabled={deployMutation.isPending}
            className={env.value === "production" ? env.color : ""}
          >
            <Rocket className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{env.label}</span>
            <span className="sm:hidden">{env.label.slice(0, 3)}</span>
          </Button>
        ))}
      </div>

      <DeployConfirmDialog />
    </>
  );
}
