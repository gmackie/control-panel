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
  Settings, 
  ExternalLink,
  MoreVertical,
  Shield,
  Globe,
  Clock
} from "lucide-react";
import Link from "next/link";
import { Application } from "@/types/applications";
import { AppCreationWizard } from "@/components/applications/AppCreationWizard";

export default function ApplicationsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: applications, isLoading, refetch } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => {
      const response = await fetch("/api/applications");
      if (!response.ok) throw new Error("Failed to fetch applications");
      return response.json();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Applications</h1>
          <p className="text-gray-400">
            Manage your applications, API keys, and secrets
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Application
        </Button>
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
            <Link key={app.id} href={`/applications/${app.id}`}>
              <Card className="p-6 hover:border-gray-700 transition-colors cursor-pointer h-full">
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
                  <Badge variant={getEnvironmentColor(app.settings.environment) as any}>
                    {app.settings.environment}
                  </Badge>
                </div>

                {app.description && (
                  <p className="text-sm text-gray-400 mb-4">{app.description}</p>
                )}

                <div className="space-y-3">
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
                      <span className="text-gray-400">{app.settings.domain}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Created {new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Code className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No applications yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first application to start managing API keys and secrets
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Application
          </Button>
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
    </div>
  );
}