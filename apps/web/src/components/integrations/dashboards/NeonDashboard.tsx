"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  GitBranch,
  Server,
  HardDrive,
  Clock,
  Activity,
  ExternalLink,
  RefreshCw,
  Plus,
  Copy,
  Check,
} from "lucide-react";

interface NeonStats {
  totalProjects: number;
  totalBranches: number;
  totalEndpoints: number;
  totalDatabases: number;
  activeEndpoints: number;
  idleEndpoints: number;
  totalStorageMB: number;
  totalComputeHours: number;
  totalWrittenMB: number;
  totalTransferMB: number;
  projects: Array<{
    id: string;
    name: string;
    region: string;
    pgVersion: number;
    branchCount: number;
    endpointCount: number;
    databaseCount: number;
    activeEndpoints: number;
    storageBytes: number;
    computeSeconds: number;
    createdAt: string;
  }>;
  regions: string[];
  pgVersions: number[];
}

export function NeonDashboard() {
  const [stats, setStats] = useState<NeonStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/neon?action=stats");
      if (!response.ok) {
        throw new Error("Failed to fetch Neon stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Neon data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            Make sure NEON_API_KEY is configured in your environment variables.
          </p>
          <Button onClick={fetchStats} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header with external link */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-green-500" />
            Neon PostgreSQL
          </h2>
          <p className="text-sm text-gray-400">Serverless PostgreSQL with branching</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <a
            href="https://console.neon.tech"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Console
            </Button>
          </a>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Database className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalProjects}</p>
              <p className="text-sm text-gray-400">Projects</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <GitBranch className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalBranches}</p>
              <p className="text-sm text-gray-400">Branches</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Server className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats.activeEndpoints}/{stats.totalEndpoints}
              </p>
              <p className="text-sm text-gray-400">Active Endpoints</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <HardDrive className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStorageMB.toFixed(1)} MB</p>
              <p className="text-sm text-gray-400">Storage Used</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Usage Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Usage Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Compute Hours</span>
            </div>
            <p className="text-xl font-semibold">{stats.totalComputeHours.toFixed(2)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Data Written</span>
            </div>
            <p className="text-xl font-semibold">{stats.totalWrittenMB.toFixed(2)} MB</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Data Transfer</span>
            </div>
            <p className="text-xl font-semibold">{stats.totalTransferMB.toFixed(2)} MB</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Database className="h-4 w-4" />
              <span className="text-sm">Databases</span>
            </div>
            <p className="text-xl font-semibold">{stats.totalDatabases}</p>
          </div>
        </div>
      </Card>

      {/* Projects List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Projects</h3>
          <a
            href="https://console.neon.tech/app/projects/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </a>
        </div>

        {stats.projects.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No projects found</p>
        ) : (
          <div className="space-y-3">
            {stats.projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Database className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{project.name}</p>
                      <Badge variant="outline" className="text-xs">
                        PG {project.pgVersion}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {project.region}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {project.branchCount} branches
                      </span>
                      <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        {project.activeEndpoints}/{project.endpointCount} endpoints
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {(project.storageBytes / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(project.id, project.id)}
                  >
                    {copiedId === project.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <a
                    href={`https://console.neon.tech/app/projects/${project.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Info */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Regions</h4>
          <div className="flex flex-wrap gap-2">
            {stats.regions.map((region) => (
              <Badge key={region} variant="outline">
                {region}
              </Badge>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">PostgreSQL Versions</h4>
          <div className="flex flex-wrap gap-2">
            {stats.pgVersions.map((version) => (
              <Badge key={version} variant="outline">
                v{version}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
