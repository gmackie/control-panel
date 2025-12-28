"use client";

import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/main-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Shield,
  CreditCard,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
} from "lucide-react";
import { NeonDashboard } from "@/components/integrations/dashboards/NeonDashboard";
import { ClerkDashboard } from "@/components/integrations/dashboards/ClerkDashboard";
import { StripeDashboard } from "@/components/integrations/dashboards/StripeDashboard";
import { SentryDashboard } from "@/components/integrations/dashboards/SentryDashboard";
import { PostHogDashboard } from "@/components/integrations/dashboards/PostHogDashboard";

type IntegrationTab = "overview" | "neon" | "clerk" | "stripe" | "sentry" | "posthog";

interface IntegrationStatus {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "error" | "not_configured";
  description: string;
  envVar: string;
}

export default function IntegrationHubPage() {
  const [activeTab, setActiveTab] = useState<IntegrationTab>("overview");
  const [healthChecks, setHealthChecks] = useState<Record<string, boolean>>({});
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    const checks: Record<string, boolean> = {};

    const services = ["neon", "clerk", "stripe", "sentry", "posthog"];

    await Promise.all(
      services.map(async (service) => {
        try {
          const res = await fetch(`/api/integrations/${service}?action=health`);
          const data = await res.json();
          checks[service] = data.healthy === true;
        } catch {
          checks[service] = false;
        }
      })
    );

    setHealthChecks(checks);
    setIsCheckingHealth(false);
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const integrations: IntegrationStatus[] = [
    {
      id: "neon",
      name: "Neon",
      icon: <Database className="h-5 w-5" />,
      status: healthChecks.neon ? "connected" : healthChecks.neon === false ? "error" : "not_configured",
      description: "Serverless PostgreSQL",
      envVar: "NEON_API_KEY",
    },
    {
      id: "clerk",
      name: "Clerk",
      icon: <Shield className="h-5 w-5" />,
      status: healthChecks.clerk ? "connected" : healthChecks.clerk === false ? "error" : "not_configured",
      description: "Authentication & Users",
      envVar: "CLERK_SECRET_KEY",
    },
    {
      id: "stripe",
      name: "Stripe",
      icon: <CreditCard className="h-5 w-5" />,
      status: healthChecks.stripe ? "connected" : healthChecks.stripe === false ? "error" : "not_configured",
      description: "Payments & Billing",
      envVar: "STRIPE_SECRET_KEY",
    },
    {
      id: "sentry",
      name: "Sentry",
      icon: <AlertTriangle className="h-5 w-5" />,
      status: healthChecks.sentry ? "connected" : healthChecks.sentry === false ? "error" : "not_configured",
      description: "Error Tracking",
      envVar: "SENTRY_AUTH_TOKEN",
    },
    {
      id: "posthog",
      name: "PostHog",
      icon: <BarChart3 className="h-5 w-5" />,
      status: healthChecks.posthog ? "connected" : healthChecks.posthog === false ? "error" : "not_configured",
      description: "Product Analytics",
      envVar: "POSTHOG_API_KEY",
    },
  ];

  const getStatusBadge = (status: IntegrationStatus["status"]) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Connected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="error" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Not Configured
          </Badge>
        );
    }
  };

  const connectedCount = integrations.filter((i) => i.status === "connected").length;

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Integration Hub</h1>
        <p className="mt-2 text-muted-foreground">
          Single pane of glass for all your third-party integrations
        </p>
      </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={activeTab === "overview" ? "default" : "ghost"}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </Button>
          {integrations.map((integration) => (
            <Button
              key={integration.id}
              variant={activeTab === integration.id ? "default" : "ghost"}
              onClick={() => setActiveTab(integration.id as IntegrationTab)}
              className="flex items-center gap-2"
            >
              {integration.icon}
              {integration.name}
              {integration.status === "connected" && (
                <span className="w-2 h-2 bg-green-500 rounded-full" />
              )}
            </Button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Summary */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Integration Status</h2>
                  <p className="text-sm text-gray-400">
                    {connectedCount} of {integrations.length} integrations connected
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkHealth}
                  disabled={isCheckingHealth}
                >
                  {isCheckingHealth ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Check Health
                </Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      integration.status === "connected"
                        ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                        : integration.status === "error"
                        ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                        : "border-gray-700 bg-gray-900 hover:bg-gray-800"
                    }`}
                    onClick={() => setActiveTab(integration.id as IntegrationTab)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            integration.status === "connected"
                              ? "bg-green-500/20 text-green-500"
                              : integration.status === "error"
                              ? "bg-red-500/20 text-red-500"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {integration.icon}
                        </div>
                        <div>
                          <p className="font-medium">{integration.name}</p>
                          <p className="text-sm text-gray-400">{integration.description}</p>
                        </div>
                      </div>
                      {getStatusBadge(integration.status)}
                    </div>
                    {integration.status !== "connected" && (
                      <p className="text-xs text-gray-500 mt-3">
                        Set <code className="bg-gray-800 px-1 rounded">{integration.envVar}</code> to connect
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Stats for Connected Services */}
            {connectedCount > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Overview</h2>
                <p className="text-gray-400">
                  Click on an integration tab above to view detailed metrics and take actions.
                </p>
              </Card>
            )}
          </div>
        )}

        {activeTab === "neon" && <NeonDashboard />}
        {activeTab === "clerk" && <ClerkDashboard />}
        {activeTab === "stripe" && <StripeDashboard />}
        {activeTab === "sentry" && <SentryDashboard />}
        {activeTab === "posthog" && <PostHogDashboard />}
    </MainLayout>
  );
}
