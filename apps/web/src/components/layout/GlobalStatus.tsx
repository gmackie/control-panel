"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  Server,
  Database,
  GitBranch,
  Shield,
  Zap,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latency?: number;
  lastCheck?: string;
  message?: string;
}

interface SystemHealth {
  overall: "operational" | "degraded" | "outage" | "unknown";
  services: ServiceHealth[];
  lastUpdated: string;
  activeIncidents: number;
}

export function GlobalStatus() {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch system health status
  const { data: health, isLoading, refetch, isFetching } = useQuery<SystemHealth>({
    queryKey: ["global-system-health"],
    queryFn: async () => {
      // Aggregate health from multiple sources
      const results = await Promise.allSettled([
        // K8s health
        fetch("/api/resources/k8s?resource=nodes").then(r => r.json()),
        // Integration health
        fetch("/api/integrations/health").then(r => r.json()),
        // Core system health (includes database)
        fetch("/api/health").then(r => r.json()),
      ]);

      const services: ServiceHealth[] = [];
      let overallHealthy = true;
      let hasDegraded = false;

      // Process K8s nodes
      const k8sResult = results[0];
      if (k8sResult.status === "fulfilled" && k8sResult.value?.data) {
        const nodes = k8sResult.value.data;
        const readyNodes = nodes.filter((n: any) => n.status === "Ready").length;
        const totalNodes = nodes.length;
        
        services.push({
          name: "Kubernetes Cluster",
          status: readyNodes === totalNodes ? "healthy" : readyNodes > 0 ? "degraded" : "unhealthy",
          message: `${readyNodes}/${totalNodes} nodes ready`,
        });
        
        if (readyNodes < totalNodes) hasDegraded = true;
        if (readyNodes === 0) overallHealthy = false;
      } else {
        services.push({
          name: "Kubernetes Cluster",
          status: "unknown",
          message: "Unable to fetch status",
        });
      }

      // Process integrations
      const integrationsResult = results[1];
      if (integrationsResult.status === "fulfilled") {
        const integrations = integrationsResult.value;
        const healthyIntegrations = Object.values(integrations).filter((i: any) => i?.healthy).length;
        const totalIntegrations = Object.keys(integrations).length;
        
        if (totalIntegrations > 0) {
          services.push({
            name: "Integrations",
            status: healthyIntegrations === totalIntegrations ? "healthy" : healthyIntegrations > 0 ? "degraded" : "unhealthy",
            message: `${healthyIntegrations}/${totalIntegrations} services connected`,
          });
          
          if (healthyIntegrations < totalIntegrations) hasDegraded = true;
        }
      }

      // Process database
      const dbResult = results[2];
      if (dbResult.status === "fulfilled") {
        const systemHealth = dbResult.value;
        const dbCheck = Array.isArray(systemHealth?.checks)
          ? systemHealth.checks.find((c: any) => c?.service === "database")
          : undefined;

        if (dbCheck) {
          const isHealthy = dbCheck.status === "healthy";
          services.push({
            name: "Database",
            status: isHealthy ? "healthy" : "unhealthy",
            latency: dbCheck.latencyMs,
            message: isHealthy ? "Connected" : (dbCheck.message || "Connection error"),
          });

          if (!isHealthy) overallHealthy = false;
        } else {
          services.push({
            name: "Database",
            status: "unknown",
            message: "Unable to fetch status",
          });
        }
      }

      // Add Gitea status (check via API)
      try {
        const giteaRes = await fetch("/api/resources/gitea?resource=repositories");
        const giteaData = await giteaRes.json();
        services.push({
          name: "Gitea",
          status: giteaRes.ok ? "healthy" : "unhealthy",
          message: giteaRes.ok ? `${giteaData.data?.length || 0} repositories` : "Connection error",
        });
        if (!giteaRes.ok) hasDegraded = true;
      } catch {
        services.push({
          name: "Gitea",
          status: "unknown",
          message: "Unable to connect",
        });
      }

      // Determine overall status
      let overall: SystemHealth["overall"] = "operational";
      if (!overallHealthy) overall = "outage";
      else if (hasDegraded) overall = "degraded";

      return {
        overall,
        services,
        lastUpdated: new Date().toISOString(),
        activeIncidents: overall !== "operational" ? 1 : 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
      case "healthy":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "outage":
      case "unhealthy":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "operational":
      case "healthy":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "outage":
      case "unhealthy":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "outage":
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "operational":
        return "All Systems Operational";
      case "degraded":
        return "Degraded Performance";
      case "outage":
        return "Service Outage";
      default:
        return "Checking Status...";
    }
  };

  const getServiceIcon = (name: string) => {
    if (name.includes("Kubernetes")) return <Server className="h-4 w-4" />;
    if (name.includes("Database")) return <Database className="h-4 w-4" />;
    if (name.includes("Gitea")) return <GitBranch className="h-4 w-4" />;
    if (name.includes("Integration")) return <Zap className="h-4 w-4" />;
    return <Shield className="h-4 w-4" />;
  };

  const overall = health?.overall || "unknown";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm transition-colors hover:bg-muted ${
            overall === "operational" ? "bg-green-500/10" :
            overall === "degraded" ? "bg-yellow-500/10" :
            overall === "outage" ? "bg-red-500/10" :
            "bg-muted/50"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${getStatusBgColor(overall)} ${
            overall === "operational" ? "animate-pulse" : ""
          }`} />
          <span className={`text-xs font-medium ${getStatusColor(overall)}`}>
            {isLoading ? "Checking..." : getStatusLabel(overall)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(overall)}
              <span className="font-medium">{getStatusLabel(overall)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {health?.lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Last checked: {new Date(health.lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="p-2 max-h-[300px] overflow-y-auto">
          {health?.services.map((service, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                {getServiceIcon(service.name)}
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-gray-500">{service.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {service.latency && (
                  <span className="text-xs text-gray-500">{service.latency}ms</span>
                )}
                {getStatusIcon(service.status)}
              </div>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-gray-800">
          <Link href="/health">
            <Button variant="ghost" size="sm" className="w-full justify-between">
              View Full Status
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
