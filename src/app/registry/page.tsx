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
  Copy,
  Shield,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Scan
} from "lucide-react";

interface TagInfo {
  name: string;
  digest: string;
  size: number;
  pushedAt: string;
  pulledAt?: string;
  immutable: boolean;
  architecture?: string;
  os?: string;
}

interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  scanStatus?: string;
}

interface Repository {
  id: number;
  name: string;
  fullName: string;
  project: string;
  description?: string;
  artifactCount: number;
  pullCount: number;
  createdAt: string;
  updatedAt: string;
  size: number;
  tags: TagInfo[];
  latestTag?: TagInfo;
  vulnerabilities?: VulnerabilitySummary;
}

interface RegistryStats {
  totalProjects: number;
  totalRepositories: number;
  totalTags: number;
  totalSize: number;
  totalPullCount: number;
  publicProjects: number;
  privateProjects: number;
}

export default function RegistryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());

  const { data: stats, isLoading: statsLoading } = useQuery<RegistryStats>({
    queryKey: ['registry', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/registry');
      if (!response.ok) throw new Error('Failed to fetch registry stats');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const { data: repositories, isLoading: reposLoading, error: reposError } = useQuery<Repository[]>({
    queryKey: ['registry', 'repositories'],
    queryFn: async () => {
      const response = await fetch('/api/registry/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      return response.json();
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async ({ project, repository, tag, digest }: { project: string; repository: string; tag: string; digest: string }) => {
      const params = new URLSearchParams({
        project,
        repository,
        tag,
        digest,
      });
      const response = await fetch(`/api/registry/repositories?${params}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete tag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async ({ project, repository, reference }: { project: string; repository: string; reference: string }) => {
      const response = await fetch('/api/registry/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', project, repository, reference }),
      });
      if (!response.ok) throw new Error('Failed to trigger scan');
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

  const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr === '0001-01-01T00:00:00.000Z') return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const copyDockerCommand = (fullName: string, tag: string) => {
    const command = `docker pull registry.gmac.io/${fullName}:${tag}`;
    navigator.clipboard.writeText(command);
  };

  const toggleExpanded = (repoName: string) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repoName)) {
      newExpanded.delete(repoName);
    } else {
      newExpanded.add(repoName);
    }
    setExpandedRepos(newExpanded);
  };

  const getVulnBadge = (vulns?: VulnerabilitySummary) => {
    if (!vulns || vulns.total === 0) {
      return <Badge variant="outline" className="text-green-500 border-green-500">Clean</Badge>;
    }
    if (vulns.critical > 0) {
      return <Badge variant="error">{vulns.critical} Critical</Badge>;
    }
    if (vulns.high > 0) {
      return <Badge className="bg-orange-500">{vulns.high} High</Badge>;
    }
    if (vulns.medium > 0) {
      return <Badge className="bg-yellow-500 text-black">{vulns.medium} Medium</Badge>;
    }
    return <Badge variant="secondary">{vulns.low} Low</Badge>;
  };

  const filteredRepos = repositories?.filter(repo =>
    repo.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Group by project
  const groupedRepos = filteredRepos.reduce((acc, repo) => {
    if (!acc[repo.project]) {
      acc[repo.project] = [];
    }
    acc[repo.project].push(repo);
    return acc;
  }, {} as Record<string, Repository[]>);

  if (statsLoading || reposLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (reposError) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Failed to load registry data</p>
          <p className="text-sm text-gray-500 mt-2">{String(reposError)}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">Harbor Registry</h1>
            <p className="text-gray-400">registry.gmac.io</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['registry'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-gray-400">Projects</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalProjects}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-green-500" />
              <p className="text-xs text-gray-400">Repositories</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalRepositories}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-gray-400">Tags</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalTags}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-gray-400">Total Pulls</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalPullCount}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-cyan-500" />
              <p className="text-xs text-gray-400">Total Size</p>
            </div>
            <p className="text-2xl font-bold">{formatBytes(stats.totalSize)}</p>
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

      {/* Repositories by Project */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Repositories</h2>
          
          {Object.entries(groupedRepos).map(([project, repos]) => (
            <div key={project} className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                {project} ({repos.length})
              </h3>
              <div className="space-y-3">
                {repos.map((repo) => (
                  <Card
                    key={repo.fullName}
                    className={`transition-all ${
                      selectedRepo?.fullName === repo.fullName
                        ? 'border-blue-500 bg-blue-950/20'
                        : 'hover:border-gray-700'
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setSelectedRepo(repo)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{repo.name}</h4>
                            {getVulnBadge(repo.vulnerabilities)}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {repo.tags.length} tags
                            </span>
                            <span>{formatBytes(repo.size)}</span>
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {repo.pullCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(repo.updatedAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(repo.fullName);
                          }}
                          className="p-1 hover:bg-gray-800 rounded"
                        >
                          {expandedRepos.has(repo.fullName) ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </button>
                      </div>

                      {/* Quick tag list */}
                      {expandedRepos.has(repo.fullName) && (
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          <div className="flex flex-wrap gap-2">
                            {repo.tags.slice(0, 10).map((tag) => (
                              <Badge
                                key={tag.name}
                                variant={tag.name === 'latest' ? 'default' : 'secondary'}
                                className="cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyDockerCommand(repo.fullName, tag.name);
                                }}
                              >
                                {tag.name}
                              </Badge>
                            ))}
                            {repo.tags.length > 10 && (
                              <Badge variant="outline">+{repo.tags.length - 10} more</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedRepos).length === 0 && (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No repositories found</p>
            </Card>
          )}
        </div>

        {/* Repository Details */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Details</h2>
          {selectedRepo ? (
            <Card className="p-6 sticky top-4">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-1">{selectedRepo.name}</h3>
                <p className="text-sm text-gray-400">{selectedRepo.fullName}</p>
                {selectedRepo.description && (
                  <p className="text-sm text-gray-500 mt-2">{selectedRepo.description}</p>
                )}
              </div>

              {/* Vulnerability Summary */}
              {selectedRepo.vulnerabilities && selectedRepo.vulnerabilities.total > 0 && (
                <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Vulnerabilities
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-2xl font-bold text-red-500">{selectedRepo.vulnerabilities.critical}</div>
                      <div className="text-xs text-gray-400">Critical</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-500">{selectedRepo.vulnerabilities.high}</div>
                      <div className="text-xs text-gray-400">High</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-500">{selectedRepo.vulnerabilities.medium}</div>
                      <div className="text-xs text-gray-400">Medium</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-500">{selectedRepo.vulnerabilities.low}</div>
                      <div className="text-xs text-gray-400">Low</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Tags ({selectedRepo.tags.length})</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedRepo.tags.map((tag) => (
                      <div
                        key={tag.name}
                        className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={tag.name === 'latest' ? 'default' : 'secondary'}>
                              {tag.name}
                            </Badge>
                            {tag.architecture && (
                              <span className="text-xs text-gray-500">{tag.architecture}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatBytes(tag.size)} • {formatDate(tag.pushedAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyDockerCommand(selectedRepo.fullName, tag.name)}
                            className="p-1.5 hover:bg-gray-800 rounded"
                            title="Copy pull command"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => scanMutation.mutate({
                              project: selectedRepo.project,
                              repository: selectedRepo.name,
                              reference: tag.digest,
                            })}
                            className="p-1.5 hover:bg-gray-800 rounded"
                            title="Trigger scan"
                          >
                            <Scan className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${selectedRepo.fullName}:${tag.name}?`)) {
                                deleteTagMutation.mutate({
                                  project: selectedRepo.project,
                                  repository: selectedRepo.name,
                                  tag: tag.name,
                                  digest: tag.digest,
                                });
                              }
                            }}
                            className="p-1.5 hover:bg-gray-800 rounded text-red-500"
                            title="Delete tag"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Pull Command</h4>
                  <div className="p-3 bg-gray-900 rounded-lg font-mono text-xs break-all">
                    docker pull registry.gmac.io/{selectedRepo.fullName}:latest
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Push Command</h4>
                  <div className="p-3 bg-gray-900 rounded-lg font-mono text-xs space-y-1">
                    <div className="break-all">docker tag myimage registry.gmac.io/{selectedRepo.fullName}:tag</div>
                    <div className="break-all">docker push registry.gmac.io/{selectedRepo.fullName}:tag</div>
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
