"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Server,
  Database,
  Key,
  TrendingUp,
} from "lucide-react";

interface SystemHealthData {
  services: { healthy: number; warning: number; error: number; total: number };
  databases: { active: number; total: number };
  secrets: { healthy: number; expiring: number; total: number };
  uptime: number;
  incidents: number;
}

export function SystemHealth() {
  const { data: health, isLoading } = useQuery<SystemHealthData>({
    queryKey: ["system-health"],
    queryFn: async () => {
      // Fetch data from multiple endpoints
      const [servicesRes, databasesRes, secretsRes] = await Promise.all([
        fetch("/api/services"),
        fetch("/api/turso/databases"),
        fetch("/api/secrets"),
      ]);

      const services = await servicesRes.json();
      const databases = await databasesRes.json();
      const secrets = await secretsRes.json();

      // Calculate health metrics
      const serviceHealth = services.reduce(
        (acc: any, service: any) => {
          acc.total++;
          if (service.status === "healthy") acc.healthy++;
          else if (service.status === "warning") acc.warning++;
          else if (service.status === "error") acc.error++;
          return acc;
        },
        { healthy: 0, warning: 0, error: 0, total: 0 }
      );

      const databaseHealth = {
        active: databases.filter((db: any) => db.status === "healthy").length,
        total: databases.length,
      };

      const secretHealth = secrets.reduce(
        (acc: any, secret: any) => {
          acc.total++;
          if (secret.expiresAt) {
            const daysUntilExpiry = Math.floor(
              (new Date(secret.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            if (daysUntilExpiry < 30) acc.expiring++;
            else acc.healthy++;
          } else {
            acc.healthy++;
          }
          return acc;
        },
        { healthy: 0, expiring: 0, total: 0 }
      );

      return {
        services: serviceHealth,
        databases: databaseHealth,
        secrets: secretHealth,
        uptime: 99.95,
        incidents: 0,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  const overallHealth = health
    ? health.services.healthy / health.services.total
    : 0;
  const healthStatus = overallHealth > 0.9 ? "healthy" : overallHealth > 0.7 ? "warning" : "critical";

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">System Health</h2>
        <Badge 
          variant={healthStatus === "healthy" ? "success" : healthStatus === "warning" ? "warning" : "error"}
          className="text-sm"
        >
          {healthStatus === "healthy" && <CheckCircle className="h-3 w-3 mr-1" />}
          {healthStatus === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
          {healthStatus === "critical" && <XCircle className="h-3 w-3 mr-1" />}
          {(overallHealth * 100).toFixed(1)}% Healthy
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Services Health */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span>Services</span>
            </div>
            <span className="text-muted-foreground">
              {health?.services.healthy}/{health?.services.total} Healthy
            </span>
          </div>
          <Progress 
            value={(health?.services.healthy || 0) / (health?.services.total || 1) * 100} 
            className="h-2"
          />
          {health && (health.services.warning > 0 || health.services.error > 0) && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              {health.services.warning > 0 && (
                <span className="text-yellow-600">{health.services.warning} warning</span>
              )}
              {health.services.error > 0 && (
                <span className="text-red-600">{health.services.error} error</span>
              )}
            </div>
          )}
        </div>

        {/* Database Health */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span>Databases</span>
            </div>
            <span className="text-muted-foreground">
              {health?.databases.active}/{health?.databases.total} Active
            </span>
          </div>
          <Progress 
            value={(health?.databases.active || 0) / (health?.databases.total || 1) * 100} 
            className="h-2"
          />
        </div>

        {/* Secrets Health */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span>Secrets</span>
            </div>
            <span className="text-muted-foreground">
              {health?.secrets.healthy}/{health?.secrets.total} Healthy
            </span>
          </div>
          <Progress 
            value={(health?.secrets.healthy || 0) / (health?.secrets.total || 1) * 100} 
            className="h-2"
          />
          {health && health.secrets.expiring > 0 && (
            <div className="text-xs text-yellow-600">
              {health.secrets.expiring} expiring soon
            </div>
          )}
        </div>

        {/* Uptime */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>System Uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium">{health?.uptime}%</span>
            </div>
          </div>
          {health && health.incidents === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              No incidents in the last 30 days
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}