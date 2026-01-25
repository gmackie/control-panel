"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Code,
  Key,
  Shield,
  Globe,
  Clock,
  Download,
  LayoutDashboard,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Application } from "@/types/applications";
import { AppCreationWizard } from "@/components/applications/AppCreationWizard";
import { ImportAppWizard } from "@/components/applications/ImportAppWizard";
import { K8sImportWizard } from "@/components/applications/K8sImportWizard";
import { ProviderBadges } from "@/components/applications/ProviderBadges";

export default function ApplicationsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showK8sImportModal, setShowK8sImportModal] = useState(false);

  const { data: applications, isLoading, refetch } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => {
      const response = await fetch("/api/applications");
      if (!response.ok) throw new Error("Failed to fetch applications");
      const data = await response.json();
      // Handle both formats: array or { applications: [...] }
      return Array.isArray(data) ? data : (data.applications || []);
    },
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Applications</h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Manage your applications, API keys, and secrets
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowK8sImportModal(true)}>
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Import from K8s</span>
          </Button>
          <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowImportModal(true)}>
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Import from Repo</span>
          </Button>
          <Link href="/applications/new">
            <Button size="sm" className="sm:size-default">
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Create from Template</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Advanced</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-800 rounded w-full"></div>
                <div className="h-4 bg-gray-800 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : applications && applications.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map((app) => (
            <Card key={app.id} className="p-6 hover:border-gray-700 transition-colors h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-950/20 rounded-lg">
                    <Code className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{app.name}</h3>
                    <p className="text-sm text-gray-400">{app.slug}</p>
                  </div>
                </div>
                <Badge variant={getEnvironmentColor(app.settings.environment) as "default" | "warning" | "error" | "secondary"}>
                  {app.settings.environment}
                </Badge>
              </div>

              {app.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{app.description}</p>
              )}

              <ProviderBadges
                gitProvider={app.gitProvider}
                deployProvider={app.deployProvider}
                dbProvider={app.dbProvider}
                className="mb-4"
              />

              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <Key className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-400">
                    {app.apiKeys.length} API {app.apiKeys.length === 1 ? 'Key' : 'Keys'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-400">
                    {app.secrets.length} {app.secrets.length === 1 ? 'Secret' : 'Secrets'}
                  </span>
                </div>
                {app.settings.domain && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400 truncate">{app.settings.domain}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Created {new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/applications/${app.id}/dashboard`} className="flex-1 sm:flex-none">
                    <Button variant="outline" size="sm" className="h-7 px-2 w-full sm:w-auto">
                      <LayoutDashboard className="h-3 w-3 mr-1" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href={`/applications/${app.id}`} className="flex-1 sm:flex-none">
                    <Button variant="ghost" size="sm" className="h-7 px-2 w-full sm:w-auto">
                      Details
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Code className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No applications yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first application from a template with pre-configured integrations
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/applications/new">
              <Button>
                <Sparkles className="h-4 w-4 mr-2" />
                Create from Template
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Advanced Setup
            </Button>
          </div>
        </Card>
      )}

      {showCreateModal && (
        <AppCreationWizard
          onClose={() => setShowCreateModal(false)}
          onSuccess={(appId) => {
            setShowCreateModal(false);
            refetch();
            // Optionally redirect to the new app
            // router.push(`/applications/${appId}`);
          }}
        />
      )}

      <ImportAppWizard
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          refetch();
        }}
      />

      <K8sImportWizard
        isOpen={showK8sImportModal}
        onClose={() => setShowK8sImportModal(false)}
        onSuccess={() => {
          setShowK8sImportModal(false);
          refetch();
        }}
      />
    </div>
  );
}