"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  GitBranch,
  GitCommit,
  GitMerge,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Settings,
  Eye,
  Terminal,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Package,
  Server,
  Shield,
  Zap,
  Activity,
  Users,
  Lock,
  Unlock,
  FileCheck,
  Timer,
  Info,
  Layers,
  Target,
  ArrowRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Pipeline {
  id: string;
  name: string;
  description: string;
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  approvals: ApprovalConfig[];
  status: 'idle' | 'running' | 'success' | 'failed' | 'cancelled';
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
  giteaRepo?: string;
  droneJobId?: string;
  harborImage?: string;
  argoApp?: string;
  k3sNamespace?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  type: 'build' | 'test' | 'security' | 'deploy' | 'verify' | 'rollback';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  steps: PipelineStep[];
  parallelGroups?: PipelineStep[][];
  condition?: string;
  environment?: string;
  approvalRequired?: boolean;
  startedAt?: Date;
  completedAt?: Date;
}

interface PipelineStep {
  id: string;
  name: string;
  command: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: string;
  duration?: number;
  retries?: number;
}

interface PipelineTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'git-push' | 'pull-request';
  config: Record<string, any>;
  enabled: boolean;
}

interface ApprovalConfig {
  stage: string;
  type: 'manual' | 'automated';
  approvers: string[];
  minApprovals: number;
  timeout: number;
  conditions?: string[];
}

interface DeploymentPipelineProps {
  pipelines: Pipeline[];
  onCreatePipeline: (pipeline: Partial<Pipeline>) => void;
  onUpdatePipeline: (pipelineId: string, updates: Partial<Pipeline>) => void;
  onRunPipeline: (pipelineId: string) => void;
}

export function DeploymentPipeline({ 
  pipelines, 
  onCreatePipeline, 
  onUpdatePipeline, 
  onRunPipeline 
}: DeploymentPipelineProps) {
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [showLogs, setShowLogs] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'skipped':
        return <ChevronRight className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getStageIcon = (type: string) => {
    switch (type) {
      case 'build':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'test':
        return <FileCheck className="h-4 w-4 text-green-500" />;
      case 'security':
        return <Shield className="h-4 w-4 text-purple-500" />;
      case 'deploy':
        return <Server className="h-4 w-4 text-orange-500" />;
      case 'verify':
        return <CheckCircle className="h-4 w-4 text-cyan-500" />;
      case 'rollback':
        return <RotateCcw className="h-4 w-4 text-red-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const calculateProgress = (pipeline: Pipeline) => {
    const totalStages = pipeline.stages.length;
    const completedStages = pipeline.stages.filter(s => s.status === 'success').length;
    const failedStages = pipeline.stages.filter(s => s.status === 'failed').length;
    
    if (failedStages > 0) return { progress: 0, status: 'failed' };
    
    return {
      progress: totalStages > 0 ? (completedStages / totalStages) * 100 : 0,
      status: completedStages === totalStages ? 'completed' : 'running'
    };
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-blue-500" />
          CI/CD Pipelines
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button size="sm">
            <Play className="h-4 w-4 mr-2" />
            Create Pipeline
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {pipelines.map(pipeline => {
          const { progress } = calculateProgress(pipeline);
          
          return (
            <Card key={pipeline.id} className="p-6">
              <div className="space-y-4">
                {/* Pipeline Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-gray-800">
                      {getStatusIcon(pipeline.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{pipeline.name}</h3>
                        <Badge variant="outline" className={getStatusColor(pipeline.status)}>
                          {pipeline.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{pipeline.description}</p>
                      
                      {/* Integration Info */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {pipeline.giteaRepo && (
                          <Badge variant="secondary" className="text-xs">
                            <GitBranch className="h-3 w-3 mr-1" />
                            {pipeline.giteaRepo}
                          </Badge>
                        )}
                        {pipeline.droneJobId && (
                          <Badge variant="secondary" className="text-xs">
                            <Activity className="h-3 w-3 mr-1" />
                            Drone: {pipeline.droneJobId}
                          </Badge>
                        )}
                        {pipeline.harborImage && (
                          <Badge variant="secondary" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            Harbor Image
                          </Badge>
                        )}
                        {pipeline.argoApp && (
                          <Badge variant="secondary" className="text-xs">
                            <GitMerge className="h-3 w-3 mr-1" />
                            ArgoCD: {pipeline.argoApp}
                          </Badge>
                        )}
                        {pipeline.k3sNamespace && (
                          <Badge variant="secondary" className="text-xs">
                            <Server className="h-3 w-3 mr-1" />
                            K3s: {pipeline.k3sNamespace}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {pipeline.stages.length} stages
                        </span>
                        {pipeline.lastRun && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(pipeline.lastRun, { addSuffix: true })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {pipeline.approvals.length} approval gates
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPipeline(selectedPipeline?.id === pipeline.id ? null : pipeline)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {selectedPipeline?.id === pipeline.id ? 'Hide' : 'Details'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRunPipeline(pipeline.id)}
                      disabled={pipeline.status === 'running'}
                    >
                      {pipeline.status === 'running' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                {pipeline.status === 'running' && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-400">Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Pipeline Stages Preview */}
                <div className="flex items-center gap-2 overflow-x-auto">
                  {pipeline.stages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        stage.status === 'running' ? 'border-blue-500 bg-blue-500/10' :
                        stage.status === 'success' ? 'border-green-500 bg-green-500/10' :
                        stage.status === 'failed' ? 'border-red-500 bg-red-500/10' :
                        'border-gray-600 bg-gray-800/50'
                      } whitespace-nowrap`}>
                        {getStageIcon(stage.type)}
                        <span className="text-sm font-medium">{stage.name}</span>
                        {getStatusIcon(stage.status)}
                        {stage.approvalRequired && (
                          <Lock className="h-3 w-3 text-yellow-500" />
                        )}
                      </div>
                      {index < pipeline.stages.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Expanded Pipeline Details */}
                {selectedPipeline?.id === pipeline.id && (
                  <div className="mt-6 p-4 bg-gray-900/50 rounded-lg space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Pipeline Details
                    </h4>

                    {/* Integration Links */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-400 mb-2">Source Control</h5>
                        <div className="space-y-2">
                          {pipeline.giteaRepo && (
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <GitBranch className="h-4 w-4 mr-2" />
                              Open in Gitea
                              <ExternalLink className="h-3 w-3 ml-auto" />
                            </Button>
                          )}
                          {pipeline.droneJobId && (
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <Activity className="h-4 w-4 mr-2" />
                              View in Drone
                              <ExternalLink className="h-3 w-3 ml-auto" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-400 mb-2">Registry & Deployment</h5>
                        <div className="space-y-2">
                          {pipeline.harborImage && (
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <Package className="h-4 w-4 mr-2" />
                              View in Harbor
                              <ExternalLink className="h-3 w-3 ml-auto" />
                            </Button>
                          )}
                          {pipeline.argoApp && (
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <GitMerge className="h-4 w-4 mr-2" />
                              Open ArgoCD
                              <ExternalLink className="h-3 w-3 ml-auto" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-400 mb-2">Cluster</h5>
                        <div className="space-y-2">
                          {pipeline.k3sNamespace && (
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <Server className="h-4 w-4 mr-2" />
                              K3s Namespace
                              <ExternalLink className="h-3 w-3 ml-auto" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stage Details */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-400 mb-3">Pipeline Stages</h5>
                      <div className="space-y-3">
                        {pipeline.stages.map(stage => (
                          <Card key={stage.id} className="p-4 border-gray-800">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {getStageIcon(stage.type)}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h6 className="font-medium">{stage.name}</h6>
                                    <Badge variant="outline" className={getStatusColor(stage.status)}>
                                      {stage.status}
                                    </Badge>
                                    {stage.environment && (
                                      <Badge variant="secondary" className="text-xs">
                                        {stage.environment}
                                      </Badge>
                                    )}
                                    {stage.approvalRequired && (
                                      <Badge variant="outline" className="text-xs">
                                        <Lock className="h-3 w-3 mr-1" />
                                        Approval Required
                                      </Badge>
                                    )}
                                  </div>
                                  {stage.startedAt && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Started {formatDistanceToNow(stage.startedAt, { addSuffix: true })}
                                      {stage.completedAt && (
                                        <> • Duration: {Math.round((stage.completedAt.getTime() - stage.startedAt.getTime()) / 1000 / 60)}m</>
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleStageExpansion(stage.id)}
                                >
                                  {expandedStages.has(stage.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Terminal className="h-4 w-4 mr-1" />
                                  Logs
                                </Button>
                              </div>
                            </div>

                            {expandedStages.has(stage.id) && (
                              <div className="space-y-2 pt-3 border-t border-gray-800">
                                {stage.steps.map(step => (
                                  <div key={step.id} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                                    <div className="flex items-center gap-2">
                                      {getStatusIcon(step.status)}
                                      <span className="text-sm">{step.name}</span>
                                      {step.retries && step.retries > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          {step.retries} retries
                                        </Badge>
                                      )}
                                    </div>
                                    {step.duration && (
                                      <span className="text-xs text-gray-500">{step.duration}s</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Triggers and Approvals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-400 mb-2">Triggers</h5>
                        <div className="space-y-1">
                          {pipeline.triggers.map((trigger, index) => (
                            <div key={index} className="text-sm flex items-center gap-2">
                              <Badge variant={trigger.enabled ? "default" : "secondary"} className="text-xs">
                                {trigger.type}
                              </Badge>
                              {trigger.type === 'git-push' && trigger.config.branch && (
                                <span className="text-gray-400">on {trigger.config.branch}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-400 mb-2">Approvals</h5>
                        <div className="space-y-1">
                          {pipeline.approvals.map((approval, index) => (
                            <div key={index} className="text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {approval.stage}
                                </Badge>
                                <span className="text-gray-400">
                                  {approval.minApprovals} of {approval.approvers.length} approvers
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {pipelines.length === 0 && (
          <Card className="p-8 text-center">
            <GitBranch className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Pipelines Configured</h3>
            <p className="text-gray-500 mb-4">
              Create your first CI/CD pipeline to automate deployments from Gitea through Drone, Harbor, and ArgoCD to your K3s cluster.
            </p>
            <Button onClick={() => onCreatePipeline({})}>
              <Play className="h-4 w-4 mr-2" />
              Create Pipeline
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}