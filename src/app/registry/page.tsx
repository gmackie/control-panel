"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Database, 
  Download,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Copy,
  ExternalLink
} from "lucide-react";

interface Repository {
  name: string;
  tags: string[];
  size: number;
  pullCount: number;
  lastModified: Date;
}

interface RegistryStats {
  totalRepositories: number;
  totalTags: number;
  totalSize: number;
  totalPullCount: number;
}

export default function RegistryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<RegistryStats>({
    queryKey: ['registry', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/registry');
      if (!response.ok) throw new Error('Failed to fetch registry stats');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: repositories, isLoading: reposLoading } = useQuery<Repository[]>({
    queryKey: ['registry', 'repositories'],
    queryFn: async () => {
      const response = await fetch('/api/registry/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      return response.json();
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async ({ repository, tag }: { repository: string; tag: string }) => {
      const response = await fetch(
        `/api/registry/repositories?repository=${repository}&tag=${tag}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete image');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry'] });
    },
  });

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const copyDockerCommand = (repo: string, tag: string) => {
    const registryUrl = process.env.NEXT_PUBLIC_REGISTRY_URL || 'registry.gmac.io';
    const command = `docker pull ${registryUrl}/${repo}:${tag}`;
    navigator.clipboard.writeText(command);
  };

  const filteredRepos = repositories?.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (statsLoading || reposLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Docker Registry</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['registry'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <p className="text-gray-400">
          Manage your private Docker images and repositories
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-gray-400">Repositories</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalRepositories}</p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Database className="h-5 w-5 text-green-500" />
              <p className="text-sm text-gray-400">Total Size</p>
            </div>
            <p className="text-2xl font-bold">{formatBytes(stats.totalSize)}</p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Download className="h-5 w-5 text-purple-500" />
              <p className="text-sm text-gray-400">Total Pulls</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalPullCount}</p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Filter className="h-5 w-5 text-orange-500" />
              <p className="text-sm text-gray-400">Total Tags</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalTags}</p>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Repositories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Repositories</h2>
          <div className="space-y-4">
            {filteredRepos.map((repo) => (
              <Card
                key={repo.name}
                className={`p-4 cursor-pointer transition-all ${
                  selectedRepo?.name === repo.name
                    ? 'border-blue-500 bg-blue-950/20'
                    : 'hover:border-gray-700'
                }`}
                onClick={() => setSelectedRepo(repo)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium">{repo.name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span>{repo.tags.length} tags</span>
                      <span>{formatBytes(repo.size)}</span>
                      <span>{repo.pullCount} pulls</span>
                    </div>
                  </div>
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>

          {filteredRepos.length === 0 && (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No repositories found</p>
            </Card>
          )}
        </div>

        {/* Repository Details */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Repository Details</h2>
          {selectedRepo ? (
            <Card className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">{selectedRepo.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>Last modified: {new Date(selectedRepo.lastModified).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Tags</h4>
                  <div className="space-y-2">
                    {selectedRepo.tags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{tag}</Badge>
                          <button
                            onClick={() => copyDockerCommand(selectedRepo.name, tag)}
                            className="text-xs text-gray-400 hover:text-gray-200"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete ${selectedRepo.name}:${tag}?`)) {
                              deleteImageMutation.mutate({
                                repository: selectedRepo.name,
                                tag,
                              });
                            }
                          }}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Pull Command</h4>
                  <div className="p-3 bg-gray-900 rounded-lg font-mono text-sm">
                    docker pull {process.env.NEXT_PUBLIC_REGISTRY_URL || 'registry.gmac.io'}/{selectedRepo.name}:latest
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Push Command</h4>
                  <div className="p-3 bg-gray-900 rounded-lg font-mono text-sm space-y-1">
                    <div>docker tag myimage:latest {process.env.NEXT_PUBLIC_REGISTRY_URL || 'registry.gmac.io'}/{selectedRepo.name}:latest</div>
                    <div>docker push {process.env.NEXT_PUBLIC_REGISTRY_URL || 'registry.gmac.io'}/{selectedRepo.name}:latest</div>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <Database className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Select a repository to view details</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}