"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  Activity,
  Package,
  Rocket,
  History,
  RotateCcw,
  Eye,
  Terminal,
  ChevronDown,
  ChevronRight,
  Server,
  Globe,
  Shield,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Deployment {
  id: string;
  applicationId: string;
  applicationName: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'rolled_back';
  version: string;
  commit: {
    sha: string;
    message: string;
    author: string;
    timestamp: Date;
    branch: string;
  };
  pipeline: {
    id: string;
    url: string;
    stages: PipelineStage[];
  };
  cluster: {
    name: string;
    region: string;
    provider: 'k3s' | 'k8s';
  };
  deployment: {
    replicas: number;
    readyReplicas: number;
    image: string;
    namespace: string;
  };
  metrics?: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    latency: number;
  };
  startedAt: Date;
  completedAt?: Date;
  deployedBy: string;
  rollbackTo?: string;
}

interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  logs?: string[];
}

interface DeploymentHistory {
  id: string;
  deployment: Deployment;
  action: 'deployed' | 'rolled_back' | 'scaled' | 'updated';
  timestamp: Date;
  user: string;
  details?: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [history, setHistory] = useState<DeploymentHistory[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDeployments();
    const interval = setInterval(fetchDeployments, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [selectedEnvironment]);

  const fetchDeployments = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/deployments?environment=${selectedEnvironment}`);
      const data = await response.json();
      setDeployments(data.deployments);
      setHistory(data.history);
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleDeploy = async (applicationId: string, environment: string) => {
    try {
      const response = await fetch('/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, environment }),
      });
      
      if (response.ok) {
        await fetchDeployments();
      }
    } catch (error) {
      console.error('Failed to trigger deployment:', error);
    }
  };

  const handleRollback = async (deploymentId: string, targetVersion: string) => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersion }),
      });
      
      if (response.ok) {
        await fetchDeployments();
      }
    } catch (error) {
      console.error('Failed to rollback deployment:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'building': return 'text-blue-500';
      case 'deploying': return 'text-yellow-500';
      case 'failed': return 'text-red-500';
      case 'rolled_back': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4" />;
      case 'building': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'deploying': return <Rocket className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'rolled_back': return <RotateCcw className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-500/20 text-red-300 border-red-500';
      case 'staging': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500';
      case 'development': return 'bg-blue-500/20 text-blue-300 border-blue-500';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500';
    }
  };

  const toggleStageExpansion = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deployments</h1>
          <p className="text-gray-400 mt-1">
            Monitor and manage application deployments across all environments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeployments}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Rocket className="h-4 w-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Environment Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Environment:</span>
        {['all', 'development', 'staging', 'production'].map(env => (
          <Button
            key={env}
            variant={selectedEnvironment === env ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedEnvironment(env)}
            className={selectedEnvironment === env && env !== 'all' ? getEnvironmentColor(env) : ''}
          >
            {env.charAt(0).toUpperCase() + env.slice(1)}
          </Button>
        ))}
      </div>

      {/* Deployment Status Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Running</p>
              <p className="text-2xl font-bold text-green-500">
                {deployments.filter(d => d.status === 'running').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500/20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Building</p>
              <p className="text-2xl font-bold text-blue-500">
                {deployments.filter(d => d.status === 'building').length}
              </p>
            </div>
            <Package className="h-8 w-8 text-blue-500/20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Deploying</p>
              <p className="text-2xl font-bold text-yellow-500">
                {deployments.filter(d => d.status === 'deploying').length}
              </p>
            </div>
            <Rocket className="h-8 w-8 text-yellow-500/20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Failed</p>
              <p className="text-2xl font-bold text-red-500">
                {deployments.filter(d => d.status === 'failed').length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-500/20" />
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Deployments</TabsTrigger>
          <TabsTrigger value="pipeline">CI/CD Pipeline</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {deployments.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No deployments found
            </div>
          ) : (
            deployments.map(deployment => (
              <Card key={deployment.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Deployment Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${getStatusColor(deployment.status)} bg-opacity-20`}>
                        {getStatusIcon(deployment.status)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{deployment.applicationName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={getEnvironmentColor(deployment.environment)}>
                            {deployment.environment}
                          </Badge>
                          <span className="text-sm text-gray-400">v{deployment.version}</span>
                          <span className="text-xs text-gray-500">
                            • {formatDistanceToNow(new Date(deployment.startedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-start gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDeployment(deployment)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLogs(deployment.id)}
                      >
                        <Terminal className="h-4 w-4 mr-1" />
                        Logs
                      </Button>
                      {deployment.status === 'running' && deployment.environment !== 'production' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRollback(deployment.id, deployment.rollbackTo || '')}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="text-center py-16 text-gray-400">
            Pipeline view coming soon...
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="text-center py-16 text-gray-400">
            History view coming soon...
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}