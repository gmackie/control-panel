"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Code,
  Key,
  Shield,
  Settings,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Application, ApiKey, ApplicationSecret } from "@/types/applications";
import { ApiKeysList } from "@/components/applications/ApiKeysList";
import { SecretsList } from "@/components/applications/SecretsList";
import { IntegrationsList } from "@/components/applications/IntegrationsList";
import { DeploymentsList } from "@/components/applications/DeploymentsList";
import { ApplicationSettings } from "@/components/applications/ApplicationSettings";

export default function ApplicationDetailsPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<"overview" | "api-keys" | "secrets" | "integrations" | "deployments" | "settings">("overview");

  const { data: application, isLoading } = useQuery<Application>({
    queryKey: ["application", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch application");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Application not found</h2>
          <p className="text-gray-400">
            The application you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case "production":
        return "error";
      case "staging":
        return "warning";
      case "development":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-950/20 rounded-lg">
            <Code className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{application.name}</h1>
              <Badge variant={getEnvironmentColor(application.settings.environment) as any}>
                {application.settings.environment}
              </Badge>
            </div>
            <p className="text-gray-400 mt-1">{application.slug}</p>
            {application.description && (
              <p className="text-gray-400 mt-2">{application.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {application.settings.domain && (
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Site
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">API Keys</p>
              <p className="text-2xl font-bold">{application.apiKeys.length}</p>
            </div>
            <Key className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Secrets</p>
              <p className="text-2xl font-bold">{application.secrets.length}</p>
            </div>
            <Shield className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Integrations</p>
              <p className="text-2xl font-bold">{application.integrations.length}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Status</p>
              <p className="text-2xl font-bold capitalize">{application.status}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800">
        {["overview", "api-keys", "secrets", "integrations", "deployments", "settings"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-3 px-1 border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Key className="h-4 w-4 mr-2" />
                Generate New API Key
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Add Secret
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="h-4 w-4 mr-2" />
                Rotate All Keys
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Application Info</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Application ID</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-gray-900 px-2 py-1 rounded">{application.id}</code>
                  <Button variant="ghost" size="sm">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400">Created</p>
                <p className="text-sm">{new Date(application.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Last Updated</p>
                <p className="text-sm">{new Date(application.updatedAt).toLocaleString()}</p>
              </div>
              {application.settings.domain && (
                <div>
                  <p className="text-sm text-gray-400">Domain</p>
                  <p className="text-sm">{application.settings.domain}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "api-keys" && <ApiKeysList applicationId={params.id} />}
      {activeTab === "secrets" && <SecretsList applicationId={params.id} />}
      {activeTab === "integrations" && <IntegrationsList applicationId={params.id} />}
      {activeTab === "deployments" && <DeploymentsList applicationId={params.id} />}
      {activeTab === "settings" && <ApplicationSettings applicationId={params.id} />}
    </div>
  );
}