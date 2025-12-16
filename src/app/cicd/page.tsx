"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface Commit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
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
  recentCommits: Commit[];
  actionsUrl: string;
}

export default function CICDPage() {
  const queryClient = useQueryClient();
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [triggerBranch, setTriggerBranch] = useState("main");

  const { data: repositories, isLoading, error } = useQuery<Repository[]>({
    queryKey: ["cicd", "repositories"],
    queryFn: async () => {
      const response = await fetch("/api/cicd?action=repositories");
      if (!response.ok) throw new Error("Failed to fetch repositories");
      return response.json();
    },
  });

  const { data: workflows } = useQuery<WorkflowInfo[]>({
    queryKey: ["cicd", "workflows", selectedRepo?.full_name],
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
    queryKey: ["cicd", "branches", selectedRepo?.full_name],
    queryFn: async () => {
      if (!selectedRepo) return [];
      const [owner, repo] = selectedRepo.full_name.split("/");
      const response = await fetch(`/api/cicd?action=branches&owner=${owner}&repo=${repo}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedRepo,
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
      queryClient.invalidateQueries({ queryKey: ["cicd"] });
    },
    onError: (error: Error) => {
      alert(`Failed to trigger workflow: ${error.message}`);
    },
  });

  const toggleExpanded = (repoName: string) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repoName)) {
      newExpanded.delete(repoName);
    } else {
      newExpanded.add(repoName);
    }
    setExpandedRepos(newExpanded);
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

  const reposWithWorkflows = repositories?.filter((r) => r.hasWorkflows) || [];
  const reposWithoutWorkflows = repositories?.filter((r) => !r.hasWorkflows) || [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Failed to load CI/CD data</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">CI/CD Pipelines</h1>
            <p className="text-gray-400">Manage and trigger Gitea Actions workflows</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["cicd"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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
        {/* Repository List */}
        <div className="lg:col-span-2">
          {/* Repos with Workflows */}
          {reposWithWorkflows.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Workflow className="h-5 w-5 text-green-500" />
                Repositories with CI/CD
              </h2>
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
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setSelectedRepo(repo)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{repo.name}</h3>
                            <Badge variant="success" className="text-xs">
                              {repo.workflows.length} workflow{repo.workflows.length !== 1 ? "s" : ""}
                            </Badge>
                            {repo.private && (
                              <Badge variant="secondary" className="text-xs">Private</Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-sm text-gray-400 mt-1">{repo.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {repo.default_branch}
                            </span>
                            {repo.language && (
                              <span>{repo.language}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(repo.updated_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={repo.actionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-gray-800 rounded"
                            title="View in Gitea"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(repo.full_name);
                            }}
                            className="p-2 hover:bg-gray-800 rounded"
                          >
                            {expandedRepos.has(repo.full_name) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Recent Commits */}
                      {expandedRepos.has(repo.full_name) && repo.recentCommits.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          <h4 className="text-sm font-medium mb-2 text-gray-400">Recent Commits</h4>
                          <div className="space-y-2">
                            {repo.recentCommits.slice(0, 3).map((commit) => (
                              <div
                                key={commit.sha}
                                className="flex items-start gap-2 text-sm"
                              >
                                <GitCommit className="h-4 w-4 text-gray-500 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="truncate">{commit.message}</p>
                                  <p className="text-xs text-gray-500">
                                    {commit.shortSha} • {commit.author} • {formatDate(commit.date)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Repos without Workflows */}
          {reposWithoutWorkflows.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-400">
                <GitBranch className="h-5 w-5" />
                Other Repositories
              </h2>
              <div className="space-y-2">
                {reposWithoutWorkflows.map((repo) => (
                  <Card key={repo.id} className="p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{repo.name}</h3>
                        <p className="text-xs text-gray-500">No workflows configured</p>
                      </div>
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-800 rounded"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Workflow Details & Trigger */}
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

              {/* Branch Selector */}
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

              {/* Workflows */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Workflows</label>
                {workflows && workflows.length > 0 ? (
                  <div className="space-y-2">
                    {workflows.map((wf) => (
                      <div
                        key={wf.file}
                        className="p-3 bg-gray-900 rounded-lg"
                      >
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
                            <Badge variant="secondary" className="text-xs">
                              Push only
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {wf.triggers.push && (
                            <Badge variant="outline" className="text-xs">push</Badge>
                          )}
                          {wf.triggers.pull_request && (
                            <Badge variant="outline" className="text-xs">PR</Badge>
                          )}
                          {wf.triggers.workflow_dispatch && (
                            <Badge variant="outline" className="text-xs">manual</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Loading workflows...</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-gray-800">
                <a
                  href={selectedRepo.actionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm"
                >
                  <Rocket className="h-4 w-4" />
                  View All Runs in Gitea
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <Workflow className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Select a repository to trigger builds</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
