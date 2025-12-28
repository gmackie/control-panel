"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  GitBranch,
  GitCommit,
  Play,
  RefreshCw,
  ExternalLink,
  Clock,
  Workflow,
  ChevronDown,
  ChevronRight,
  Rocket,
  FileCode,
  AlertCircle,
  Server,
  ArrowRight,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  Database,
  Download,
  Shield,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
  language?: string;
  workflows: string[];
  hasWorkflows: boolean;
  recentCommits: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  }>;
  actionsUrl: string;
}

interface WorkflowInfo {
  name: string;
  file: string;
  path: string;
  triggers: {
    workflow_dispatch?: boolean;
    push?: boolean;
    pull_request?: boolean;
  };
}

interface CommitJourney {
  commit: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    branch: string;
    repository: string;
    timestamp: string;
    url?: string;
  };
  pipelines: Array<{
    id: string;
    status: string;
    workflowName: string;
    branch: string;
    event: string;
    duration?: number;
    url?: string;
  }>;
  deployments: {
    staging?: { status: string; imageTag: string; namespace: string; deploymentName: string };
    production?: { status: string; imageTag: string; namespace: string; deploymentName: string };
  };
  status: string;
  percentComplete: number;
}

interface EnvironmentComparison {
  repository: string;
  staging: {
    commitSha?: string;
    commitMessage?: string;
    imageTag?: string;
    deployedAt?: string;
    status?: string;
  };
  production: {
    commitSha?: string;
    commitMessage?: string;
    imageTag?: string;
    deployedAt?: string;
    status?: string;
  };
  commitsBehind: number;
  commitsAhead: Array<{ sha: string; shortSha: string; message: string }>;
}

interface RegistryStats {
  totalProjects: number;
  totalRepositories: number;
  totalTags: number;
  totalSize: number;
  totalPullCount: number;
}

interface RegistryRepo {
  id: number;
  name: string;
  fullName: string;
  project: string;
  pullCount: number;
  updatedAt: string;
  size: number;
  tags: Array<{ name: string; pushedAt: string; size: number }>;
}

const REPOSITORIES = [
  'gmackie/control-panel',
  'gmackie/classcheck-app',
  'gmackie/classback',
];

export default function PipelinesPage() {
  const queryClient = useQueryClient();
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedRepoName, setSelectedRepoName] = useState(REPOSITORIES[0]);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const [triggerBranch, setTriggerBranch] = useState("main");

  const { data: repositories, isLoading: reposLoading } = useQuery<Repository[]>({
    queryKey: ["pipelines", "repositories"],
    queryFn: async () => {
      const response = await fetch("/api/cicd?action=repositories");
      if (!response.ok) throw new Error("Failed to fetch repositories");
      return response.json();
    },
  });

  const { data: workflows } = useQuery<WorkflowInfo[]>({
    queryKey: ["pipelines", "workflows", selectedRepo?.full_name],
    queryFn: async () => {
      if (!selectedRepo) return [];
      const [owner, repo] = selectedRepo.full_name.split("/");
      const response = await fetch(`/api/cicd?action=workflows&owner=${owner}&repo=${repo}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedRepo,
  });

  const { data: branches } = useQuery<Array<{ name: string }>>({
    queryKey: ["pipelines", "branches", selectedRepo?.full_name],
    queryFn: async () => {
      if (!selectedRepo) return [];
      const [owner, repo] = selectedRepo.full_name.split("/");
      const response = await fetch(`/api/cicd?action=branches&owner=${owner}&repo=${repo}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedRepo,
  });

  const { data: journeysData, isLoading: journeysLoading, refetch: refetchJourneys } = useQuery({
    queryKey: ["pipelines", "journeys", selectedRepoName],
    queryFn: async () => {
      const response = await fetch(
        `/api/pipeline?action=journeys&repository=${encodeURIComponent(selectedRepoName)}&limit=15`
      );
      if (!response.ok) throw new Error("Failed to fetch journeys");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: comparisonData } = useQuery({
    queryKey: ["pipelines", "comparison", selectedRepoName],
    queryFn: async () => {
      const response = await fetch(
        `/api/pipeline?action=compare&repository=${encodeURIComponent(selectedRepoName)}`
      );
      if (!response.ok) throw new Error("Failed to fetch comparison");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: registryStats } = useQuery<RegistryStats>({
    queryKey: ["registry", "stats"],
    queryFn: async () => {
      const response = await fetch("/api/registry");
      if (!response.ok) throw new Error("Failed to fetch registry stats");
      return response.json();
    },
    refetchInterval: 60000,
  });

  const { data: registryRepos, isLoading: registryLoading } = useQuery<RegistryRepo[]>({
    queryKey: ["registry", "repositories"],
    queryFn: async () => {
      const response = await fetch("/api/registry/repositories");
      if (!response.ok) throw new Error("Failed to fetch repositories");
      return response.json();
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async ({ owner, repo, workflow, ref }: { owner: string; repo: string; workflow: string; ref: string }) => {
      const response = await fetch("/api/cicd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", owner, repo, workflow, ref }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger workflow");
      }
      return response.json();
    },
    onSuccess: (data) => {
      alert(`Workflow triggered successfully!\n\nView runs at: ${data.actionsUrl}`);
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
    onError: (error: Error) => {
      alert(`Failed to trigger workflow: ${error.message}`);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/pipeline?action=sync&repository=${encodeURIComponent(selectedRepoName)}`
      );
      if (!response.ok) throw new Error("Failed to sync");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

  const reposWithWorkflows = repositories?.filter((r) => r.hasWorkflows) || [];
  const journeys: CommitJourney[] = journeysData?.journeys || [];
  const comparison: EnvironmentComparison | undefined = comparisonData?.comparison;

  const toggleRepoExpand = (repoName: string) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repoName)) {
      newExpanded.delete(repoName);
    } else {
      newExpanded.add(repoName);
    }
    setExpandedRepos(newExpanded);
  };

  const toggleCommitExpand = (sha: string) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(sha)) {
      newExpanded.delete(sha);
    } else {
      newExpanded.add(sha);
    }
    setExpandedCommits(newExpanded);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const copyDockerCommand = (fullName: string, tag: string) => {
    const command = `docker pull registry.gmac.io/${fullName}:${tag}`;
    navigator.clipboard.writeText(command);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'deployed':
      case 'healthy':
      case 'production':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      case 'building':
      case 'deploying':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'deployed':
      case 'production':
        return 'success';
      case 'failure':
      case 'failed':
        return 'error';
      case 'running':
      case 'building':
      case 'staging':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Pipelines</h1>
          <p className="text-gray-400">
            CI/CD workflows and deployment tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync
          </Button>
        </div>
      </div>

      <Tabs defaultValue="deployments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deployments" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="registry" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Registry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deployments" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {REPOSITORIES.map((repo) => (
              <Button
                key={repo}
                variant={selectedRepoName === repo ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRepoName(repo)}
              >
                <GitBranch className="h-3 w-3 mr-1" />
                {repo.split('/')[1]}
              </Button>
            ))}
          </div>

          {comparison && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Server className="h-5 w-5" />
                Environment Status
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="font-medium text-yellow-500">Staging</h3>
                  {comparison.staging.commitSha ? (
                    <>
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-gray-400" />
                        <code className="text-sm">{comparison.staging.commitSha?.substring(0, 7)}</code>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{comparison.staging.commitMessage}</p>
                      <Badge variant={getStatusBadge(comparison.staging.status || 'unknown') as any}>
                        {comparison.staging.status}
                      </Badge>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No deployment</p>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-gray-600" />
                  {comparison.commitsBehind > 0 ? (
                    <p className="text-sm text-yellow-500 mt-2">
                      {comparison.commitsBehind} commits ahead
                    </p>
                  ) : (
                    <p className="text-sm text-green-500 mt-2">In sync</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-green-500">Production</h3>
                  {comparison.production.commitSha ? (
                    <>
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-gray-400" />
                        <code className="text-sm">{comparison.production.commitSha?.substring(0, 7)}</code>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{comparison.production.commitMessage}</p>
                      <Badge variant={getStatusBadge(comparison.production.status || 'unknown') as any}>
                        {comparison.production.status}
                      </Badge>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No deployment</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Commits
            </h2>

            {journeysLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-6 bg-gray-800 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-800 rounded w-1/2"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : journeys.length > 0 ? (
              journeys.map((journey) => (
                <Card key={journey.commit.sha} className="p-4">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleCommitExpand(journey.commit.sha)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {expandedCommits.has(journey.commit.sha) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-sm font-mono text-blue-400">
                            {journey.commit.shortSha}
                          </code>
                          <span className="text-gray-300">{journey.commit.message}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{journey.commit.author}</span>
                          <span>{journey.commit.branch}</span>
                          <span>{formatDate(journey.commit.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadge(journey.status) as any}>
                        {journey.status}
                      </Badge>
                      <div className="w-24">
                        <Progress value={journey.percentComplete} className="h-2" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 ml-7">
                    <div className="flex items-center gap-1">
                      <GitCommit className="h-4 w-4 text-green-500" />
                      <span className="text-xs">Commit</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-gray-600" />
                    <div className="flex items-center gap-1">
                      {getStatusIcon(journey.pipelines.length > 0 ? journey.pipelines[0].status : 'pending')}
                      <span className="text-xs">Build</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-gray-600" />
                    <div className="flex items-center gap-1">
                      {getStatusIcon(journey.deployments.staging?.status || 'pending')}
                      <span className="text-xs">Staging</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-gray-600" />
                    <div className="flex items-center gap-1">
                      {getStatusIcon(journey.deployments.production?.status || 'pending')}
                      <span className="text-xs">Production</span>
                    </div>
                  </div>

                  {expandedCommits.has(journey.commit.sha) && (
                    <div className="mt-4 ml-7 grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Server className="h-4 w-4 text-yellow-500" />
                          Staging
                        </h4>
                        {journey.deployments.staging ? (
                          <div className="p-3 bg-gray-900 rounded">
                            <div className="flex items-center justify-between mb-2">
                              {getStatusIcon(journey.deployments.staging.status)}
                              <Badge variant={getStatusBadge(journey.deployments.staging.status) as any}>
                                {journey.deployments.staging.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400">
                              {journey.deployments.staging.namespace}/{journey.deployments.staging.deploymentName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Tag: {journey.deployments.staging.imageTag}
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-900 rounded text-sm text-gray-500">
                            Not deployed
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Rocket className="h-4 w-4 text-green-500" />
                          Production
                        </h4>
                        {journey.deployments.production ? (
                          <div className="p-3 bg-gray-900 rounded">
                            <div className="flex items-center justify-between mb-2">
                              {getStatusIcon(journey.deployments.production.status)}
                              <Badge variant={getStatusBadge(journey.deployments.production.status) as any}>
                                {journey.deployments.production.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400">
                              {journey.deployments.production.namespace}/{journey.deployments.production.deploymentName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Tag: {journey.deployments.production.imageTag}
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-900 rounded text-sm text-gray-500">
                            Not deployed
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <Card className="p-12 text-center">
                <GitCommit className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No commits tracked yet</h3>
                <p className="text-gray-400 mb-4">Sync from Gitea to start tracking</p>
                <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Workflow className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-gray-400">Repos with Workflows</p>
              </div>
              <p className="text-2xl font-bold">{reposWithWorkflows.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="h-4 w-4 text-green-500" />
                <p className="text-xs text-gray-400">Total Repositories</p>
              </div>
              <p className="text-2xl font-bold">{repositories?.length || 0}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileCode className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-gray-400">Total Workflows</p>
              </div>
              <p className="text-2xl font-bold">
                {repositories?.reduce((sum, r) => sum + r.workflows.length, 0) || 0}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {reposLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="animate-pulse space-y-2">
                        <div className="h-5 bg-gray-800 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-800 rounded w-2/3"></div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : reposWithWorkflows.length > 0 ? (
                <div className="space-y-3">
                  {reposWithWorkflows.map((repo) => (
                    <Card
                      key={repo.id}
                      className={`transition-all ${
                        selectedRepo?.id === repo.id
                          ? "border-blue-500 bg-blue-950/20"
                          : "hover:border-gray-700"
                      }`}
                    >
                      <div className="p-4 cursor-pointer" onClick={() => setSelectedRepo(repo)}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{repo.name}</h3>
                              <Badge variant="success" className="text-xs">
                                {repo.workflows.length} workflow{repo.workflows.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            {repo.description && (
                              <p className="text-sm text-gray-400 mt-1">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {repo.default_branch}
                              </span>
                              {repo.language && <span>{repo.language}</span>}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(repo.updated_at)}
                              </span>
                            </div>
                          </div>
                          <a
                            href={repo.actionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-gray-800 rounded"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <Workflow className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No repositories with workflows found</p>
                </Card>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Trigger Build</h2>
              {selectedRepo ? (
                <Card className="p-6 sticky top-4">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold">{selectedRepo.name}</h3>
                    <a
                      href={selectedRepo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {selectedRepo.full_name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="mb-4">
                    <label className="text-sm text-gray-400 mb-1 block">Branch</label>
                    <select
                      value={triggerBranch}
                      onChange={(e) => setTriggerBranch(e.target.value)}
                      className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md"
                    >
                      {branches?.map((b) => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      )) || <option value="main">main</option>}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="text-sm text-gray-400 mb-2 block">Workflows</label>
                    {workflows && workflows.length > 0 ? (
                      <div className="space-y-2">
                        {workflows.map((wf) => (
                          <div key={wf.file} className="p-3 bg-gray-900 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium">{wf.name}</p>
                                <p className="text-xs text-gray-500">{wf.file}</p>
                              </div>
                              {wf.triggers.workflow_dispatch ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const [owner, repo] = selectedRepo.full_name.split("/");
                                    triggerMutation.mutate({
                                      owner,
                                      repo,
                                      workflow: wf.file,
                                      ref: triggerBranch,
                                    });
                                  }}
                                  disabled={triggerMutation.isPending}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Run
                                </Button>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Push only</Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {wf.triggers.push && <Badge variant="outline" className="text-xs">push</Badge>}
                              {wf.triggers.pull_request && <Badge variant="outline" className="text-xs">PR</Badge>}
                              {wf.triggers.workflow_dispatch && <Badge variant="outline" className="text-xs">manual</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Loading workflows...</p>
                    )}
                  </div>

                  <a
                    href={selectedRepo.actionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm"
                  >
                    <Rocket className="h-4 w-4" />
                    View All Runs
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <Workflow className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Select a repository to trigger builds</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="registry" className="space-y-4">
          {registryStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-blue-500" />
                  <p className="text-xs text-gray-400">Projects</p>
                </div>
                <p className="text-2xl font-bold">{registryStats.totalProjects}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-gray-400">Repositories</p>
                </div>
                <p className="text-2xl font-bold">{registryStats.totalRepositories}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <p className="text-xs text-gray-400">Tags</p>
                </div>
                <p className="text-2xl font-bold">{registryStats.totalTags}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Download className="h-4 w-4 text-orange-500" />
                  <p className="text-xs text-gray-400">Total Pulls</p>
                </div>
                <p className="text-2xl font-bold">{registryStats.totalPullCount}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4 text-cyan-500" />
                  <p className="text-xs text-gray-400">Total Size</p>
                </div>
                <p className="text-2xl font-bold">{formatBytes(registryStats.totalSize)}</p>
              </Card>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Images</h2>
            <Link href="/registry">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Full Registry
              </Button>
            </Link>
          </div>

          {registryLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : registryRepos && registryRepos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {registryRepos.slice(0, 9).map((repo) => (
                <Card key={repo.fullName} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{repo.name}</h3>
                      <p className="text-xs text-gray-500">{repo.project}</p>
                    </div>
                    <Badge variant="secondary">{repo.tags.length} tags</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {repo.pullCount}
                    </span>
                    <span>{formatBytes(repo.size)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(repo.updatedAt)}
                    </span>
                  </div>
                  {repo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {repo.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag.name}
                          variant={tag.name === "latest" ? "default" : "outline"}
                          className="text-xs cursor-pointer"
                          onClick={() => copyDockerCommand(repo.fullName, tag.name)}
                          title="Click to copy pull command"
                        >
                          <Copy className="h-2 w-2 mr-1" />
                          {tag.name}
                        </Badge>
                      ))}
                      {repo.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{repo.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No images in registry</h3>
              <p className="text-gray-400">Push your first image to get started</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
