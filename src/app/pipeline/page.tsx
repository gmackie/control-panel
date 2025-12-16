"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  GitCommit,
  GitBranch,
  Package,
  Server,
  Rocket,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Activity,
  AlertCircle,
  Play,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail?: string;
  authorAvatar?: string;
  branch: string;
  repository: string;
  timestamp: string;
  url?: string;
}

interface PipelineInfo {
  id: string;
  commitSha: string;
  repository: string;
  workflowName: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
  conclusion?: string;
  branch: string;
  event: string;
  triggeredBy?: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  url?: string;
  stages: StageInfo[];
}

interface StageInfo {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  order: number;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
}

interface DeploymentInfo {
  id: string;
  commitSha: string;
  repository: string;
  environment: 'staging' | 'production';
  namespace: string;
  deploymentName: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
  imageTag: string;
  replicas?: number;
  readyReplicas?: number;
  deployedAt?: string;
  healthCheckStatus?: 'healthy' | 'unhealthy' | 'unknown';
  url?: string;
}

interface CommitJourney {
  commit: CommitInfo;
  pipelines: PipelineInfo[];
  deployments: {
    staging?: DeploymentInfo;
    production?: DeploymentInfo;
  };
  status: 'pending' | 'building' | 'testing' | 'staging' | 'production' | 'failed';
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
  commitsAhead: CommitInfo[];
}

// Repository selector - would be dynamic in real app
const REPOSITORIES = [
  'gmackie/control-panel',
  'gmackie/classcheck-app',
  'gmackie/classback',
];

export default function PipelinePage() {
  const [selectedRepo, setSelectedRepo] = useState(REPOSITORIES[0]);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch commit journeys
  const { data: journeysData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["pipeline-journeys", selectedRepo],
    queryFn: async () => {
      const response = await fetch(
        `/api/pipeline?action=journeys&repository=${encodeURIComponent(selectedRepo)}&limit=15`
      );
      if (!response.ok) throw new Error("Failed to fetch journeys");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch environment comparison
  const { data: comparisonData } = useQuery({
    queryKey: ["pipeline-comparison", selectedRepo],
    queryFn: async () => {
      const response = await fetch(
        `/api/pipeline?action=compare&repository=${encodeURIComponent(selectedRepo)}`
      );
      if (!response.ok) throw new Error("Failed to fetch comparison");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/pipeline?action=sync&repository=${encodeURIComponent(selectedRepo)}`
      );
      if (!response.ok) throw new Error("Failed to sync");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-journeys"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-comparison"] });
    },
  });

  const journeys: CommitJourney[] = journeysData?.journeys || [];
  const comparison: EnvironmentComparison | undefined = comparisonData?.comparison;

  const toggleExpand = (sha: string) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(sha)) {
      newExpanded.delete(sha);
    } else {
      newExpanded.add(sha);
    }
    setExpandedCommits(newExpanded);
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
      case 'unhealthy':
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
      case 'healthy':
      case 'production':
        return 'success';
      case 'failure':
      case 'failed':
      case 'unhealthy':
        return 'error';
      case 'running':
      case 'building':
      case 'deploying':
      case 'staging':
        return 'default';
      case 'pending':
      case 'testing':
        return 'secondary';
      default:
        return 'warning';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Pipeline Tracker</h1>
          <p className="text-gray-400">
            Track commits from push to production
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
            Sync from Gitea
          </Button>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Repository Selector */}
      <div className="flex gap-2">
        {REPOSITORIES.map((repo) => (
          <Button
            key={repo}
            variant={selectedRepo === repo ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRepo(repo)}
          >
            <GitBranch className="h-3 w-3 mr-1" />
            {repo.split('/')[1]}
          </Button>
        ))}
      </div>

      {/* Environment Comparison Card */}
      {comparison && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Environment Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Staging */}
            <div className="space-y-2">
              <h3 className="font-medium text-yellow-500">Staging</h3>
              {comparison.staging.commitSha ? (
                <>
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-gray-400" />
                    <code className="text-sm">{comparison.staging.commitSha?.substring(0, 7)}</code>
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {comparison.staging.commitMessage}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Package className="h-3 w-3" />
                    {comparison.staging.imageTag}
                  </div>
                  {comparison.staging.deployedAt && (
                    <p className="text-xs text-gray-500">
                      Deployed {formatDistanceToNow(new Date(comparison.staging.deployedAt))} ago
                    </p>
                  )}
                  <Badge variant={getStatusBadge(comparison.staging.status || 'unknown') as any}>
                    {comparison.staging.status}
                  </Badge>
                </>
              ) : (
                <p className="text-sm text-gray-500">No deployment</p>
              )}
            </div>

            {/* Arrow / Commits Behind */}
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

            {/* Production */}
            <div className="space-y-2">
              <h3 className="font-medium text-green-500">Production</h3>
              {comparison.production.commitSha ? (
                <>
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-gray-400" />
                    <code className="text-sm">{comparison.production.commitSha?.substring(0, 7)}</code>
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {comparison.production.commitMessage}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Package className="h-3 w-3" />
                    {comparison.production.imageTag}
                  </div>
                  {comparison.production.deployedAt && (
                    <p className="text-xs text-gray-500">
                      Deployed {formatDistanceToNow(new Date(comparison.production.deployedAt))} ago
                    </p>
                  )}
                  <Badge variant={getStatusBadge(comparison.production.status || 'unknown') as any}>
                    {comparison.production.status}
                  </Badge>
                </>
              ) : (
                <p className="text-sm text-gray-500">No deployment</p>
              )}
            </div>
          </div>

          {/* Commits ahead list */}
          {comparison.commitsAhead && comparison.commitsAhead.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <h4 className="text-sm font-medium mb-2">Commits pending production deployment:</h4>
              <div className="space-y-1">
                {comparison.commitsAhead.slice(0, 5).map((commit) => (
                  <div key={commit.sha} className="flex items-center gap-2 text-sm">
                    <code className="text-gray-400">{commit.shortSha}</code>
                    <span className="text-gray-300 truncate">{commit.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Commit Journey List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Commits
        </h2>

        {isLoading ? (
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
              {/* Commit Header */}
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => toggleExpand(journey.commit.sha)}
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
                      <span>{formatDistanceToNow(new Date(journey.commit.timestamp))} ago</span>
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

              {/* Pipeline Stages (visual) */}
              <div className="flex items-center gap-2 mt-3 ml-7">
                {/* Commit */}
                <div className="flex items-center gap-1">
                  <GitCommit className="h-4 w-4 text-green-500" />
                  <span className="text-xs">Commit</span>
                </div>
                <ArrowRight className="h-3 w-3 text-gray-600" />
                
                {/* Build */}
                <div className="flex items-center gap-1">
                  {getStatusIcon(
                    journey.pipelines.length > 0 ? journey.pipelines[0].status : 'pending'
                  )}
                  <span className="text-xs">Build</span>
                </div>
                <ArrowRight className="h-3 w-3 text-gray-600" />
                
                {/* Staging */}
                <div className="flex items-center gap-1">
                  {getStatusIcon(journey.deployments.staging?.status || 'pending')}
                  <span className="text-xs">Staging</span>
                </div>
                <ArrowRight className="h-3 w-3 text-gray-600" />
                
                {/* Production */}
                <div className="flex items-center gap-1">
                  {getStatusIcon(journey.deployments.production?.status || 'pending')}
                  <span className="text-xs">Production</span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedCommits.has(journey.commit.sha) && (
                <div className="mt-4 ml-7 space-y-4">
                  {/* Pipelines */}
                  {journey.pipelines.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        CI/CD Pipelines
                      </h4>
                      <div className="space-y-2">
                        {journey.pipelines.map((pipeline) => (
                          <div
                            key={pipeline.id}
                            className="p-3 bg-gray-900 rounded flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              {getStatusIcon(pipeline.status)}
                              <div>
                                <p className="font-medium">{pipeline.workflowName}</p>
                                <p className="text-xs text-gray-500">
                                  {pipeline.event} on {pipeline.branch}
                                  {pipeline.triggeredBy && ` by ${pipeline.triggeredBy}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-400">
                                {formatDuration(pipeline.duration)}
                              </span>
                              {pipeline.url && (
                                <a
                                  href={pipeline.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deployments */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Staging Deployment */}
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
                          <p className="text-xs text-gray-400 mb-1">
                            {journey.deployments.staging.namespace}/{journey.deployments.staging.deploymentName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Tag: {journey.deployments.staging.imageTag}
                          </p>
                          {journey.deployments.staging.replicas !== undefined && (
                            <p className="text-xs text-gray-500">
                              Replicas: {journey.deployments.staging.readyReplicas}/{journey.deployments.staging.replicas}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-900 rounded text-sm text-gray-500">
                          Not deployed
                        </div>
                      )}
                    </div>

                    {/* Production Deployment */}
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
                          <p className="text-xs text-gray-400 mb-1">
                            {journey.deployments.production.namespace}/{journey.deployments.production.deploymentName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Tag: {journey.deployments.production.imageTag}
                          </p>
                          {journey.deployments.production.replicas !== undefined && (
                            <p className="text-xs text-gray-500">
                              Replicas: {journey.deployments.production.readyReplicas}/{journey.deployments.production.replicas}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-900 rounded text-sm text-gray-500 flex items-center justify-between">
                          <span>Not deployed</span>
                          <Button size="sm" variant="outline" disabled>
                            <Play className="h-3 w-3 mr-1" />
                            Deploy
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* External Links */}
                  <div className="flex gap-2">
                    {journey.commit.url && (
                      <a
                        href={journey.commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View in Gitea
                        <ExternalLink className="h-3 w-3" />
                      </a>
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
            <p className="text-gray-400 mb-4">
              Sync from Gitea to start tracking commits
            </p>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync Now
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
