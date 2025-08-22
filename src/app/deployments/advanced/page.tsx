"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  GitBranch,
  GitCommit,
  GitMerge,
  Rocket,
  Shield,
  Activity,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Users,
  Globe,
  Server,
  Package,
  Zap,
  TrendingUp,
  BarChart3,
  Target,
  Layers,
  Copy,
  Shuffle,
  Scale,
  Eye,
  ChevronRight,
  ChevronDown,
  Info,
  Lock,
  Unlock,
  UserCheck,
  FileCheck,
  Timer,
  Heart
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DeploymentPipeline } from "@/components/deployments/DeploymentPipeline";
import { BlueGreenDeployment } from "@/components/deployments/BlueGreenDeployment";
import { CanaryRelease } from "@/components/deployments/CanaryRelease";
import { RollbackManager } from "@/components/deployments/RollbackManager";
import { ApprovalWorkflow } from "@/components/deployments/ApprovalWorkflow";

interface DeploymentStrategy {
  id: string;
  name: string;
  type: 'rolling' | 'blue-green' | 'canary' | 'recreate' | 'a-b-testing';
  description: string;
  icon: React.ReactNode;
  recommended: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  rollbackTime: string;
  downtime: string;
}

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
  // Integration specific fields
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
  timeout: number; // minutes
  conditions?: string[];
}

interface BlueGreenConfig {
  id: string;
  applicationId: string;
  applicationName: string;
  blueEnvironment: EnvironmentConfig;
  greenEnvironment: EnvironmentConfig;
  activeEnvironment: 'blue' | 'green';
  trafficDistribution: {
    blue: number;
    green: number;
  };
  healthChecks: HealthCheck[];
  switchStrategy: 'immediate' | 'gradual' | 'manual';
  rollbackThreshold: number;
}

interface CanaryConfig {
  id: string;
  applicationId: string;
  applicationName: string;
  baselineVersion: string;
  canaryVersion: string;
  trafficPercentage: number;
  stages: CanaryStage[];
  metrics: CanaryMetric[];
  autoPromote: boolean;
  autoRollback: boolean;
  status: 'pending' | 'running' | 'promoting' | 'succeeded' | 'failed' | 'rolled_back';
}

interface CanaryStage {
  percentage: number;
  duration: number; // minutes
  metrics: string[];
  successCriteria: Record<string, any>;
}

interface CanaryMetric {
  name: string;
  type: 'latency' | 'error_rate' | 'throughput' | 'custom';
  baseline: number;
  current: number;
  threshold: number;
  status: 'healthy' | 'degraded' | 'critical';
}

interface EnvironmentConfig {
  name: string;
  url: string;
  version: string;
  replicas: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastDeployed: Date;
  metrics?: {
    requests: number;
    errors: number;
    latency: number;
    cpu: number;
    memory: number;
  };
}

interface HealthCheck {
  name: string;
  type: 'http' | 'tcp' | 'grpc' | 'custom';
  endpoint: string;
  interval: number; // seconds
  timeout: number; // seconds
  successThreshold: number;
  failureThreshold: number;
  status: 'passing' | 'warning' | 'failing';
  lastCheck: Date;
}

export default function AdvancedDeploymentsPage() {
  const [activeTab, setActiveTab] = useState<'strategies' | 'pipelines' | 'blue-green' | 'canary' | 'rollback'>('strategies');
  const [selectedStrategy, setSelectedStrategy] = useState<DeploymentStrategy | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [blueGreenConfigs, setBlueGreenConfigs] = useState<BlueGreenConfig[]>([]);
  const [canaryConfigs, setCanaryConfigs] = useState<CanaryConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDeploymentData();
  }, []);

  const fetchDeploymentData = async () => {
    try {
      setIsLoading(true);
      // Fetch deployment configurations
      const [pipelinesRes, blueGreenRes, canaryRes] = await Promise.all([
        fetch('/api/deployments/pipelines'),
        fetch('/api/deployments/blue-green'),
        fetch('/api/deployments/canary')
      ]);

      const pipelinesData = await pipelinesRes.json();
      const blueGreenData = await blueGreenRes.json();
      const canaryData = await canaryRes.json();

      setPipelines(pipelinesData.pipelines || generateMockPipelines());
      setBlueGreenConfigs(blueGreenData.configs || generateMockBlueGreenConfigs());
      setCanaryConfigs(canaryData.configs || generateMockCanaryConfigs());
    } catch (error) {
      console.error('Error fetching deployment data:', error);
      // Use mock data as fallback
      setPipelines(generateMockPipelines());
      setBlueGreenConfigs(generateMockBlueGreenConfigs());
      setCanaryConfigs(generateMockCanaryConfigs());
    } finally {
      setIsLoading(false);
    }
  };

  const deploymentStrategies: DeploymentStrategy[] = [
    {
      id: 'rolling',
      name: 'Rolling Update',
      type: 'rolling',
      description: 'Gradually replace old instances with new ones',
      icon: <RefreshCw className="h-6 w-6" />,
      recommended: true,
      riskLevel: 'low',
      rollbackTime: '< 5 min',
      downtime: 'Zero'
    },
    {
      id: 'blue-green',
      name: 'Blue-Green',
      type: 'blue-green',
      description: 'Switch traffic between two identical environments',
      icon: <Shuffle className="h-6 w-6" />,
      recommended: true,
      riskLevel: 'low',
      rollbackTime: 'Instant',
      downtime: 'Zero'
    },
    {
      id: 'canary',
      name: 'Canary Release',
      type: 'canary',
      description: 'Gradually roll out to a subset of users',
      icon: <TrendingUp className="h-6 w-6" />,
      recommended: false,
      riskLevel: 'medium',
      rollbackTime: '< 2 min',
      downtime: 'Zero'
    },
    {
      id: 'recreate',
      name: 'Recreate',
      type: 'recreate',
      description: 'Terminate old version then deploy new version',
      icon: <RotateCcw className="h-6 w-6" />,
      recommended: false,
      riskLevel: 'high',
      rollbackTime: '5-10 min',
      downtime: '1-5 min'
    },
    {
      id: 'a-b-testing',
      name: 'A/B Testing',
      type: 'a-b-testing',
      description: 'Route specific users to different versions',
      icon: <Scale className="h-6 w-6" />,
      recommended: false,
      riskLevel: 'medium',
      rollbackTime: 'Instant',
      downtime: 'Zero'
    }
  ];

  const generateMockPipelines = (): Pipeline[] => {
    return [
      {
        id: 'pipeline-001',
        name: 'Gitea → Drone → Harbor → ArgoCD Pipeline',
        description: 'Full CI/CD pipeline integrated with Gitea, Drone CI, Harbor Registry, and ArgoCD',
        giteaRepo: 'gmac/control-panel',
        droneJobId: 'drone-job-1234',
        harborImage: 'harbor.gmac.io/production/control-panel:v2.4.0',
        argoApp: 'control-panel-prod',
        k3sNamespace: 'production',
        stages: [
          {
            id: 'stage-001',
            name: 'Gitea Source',
            type: 'build',
            status: 'success',
            steps: [
              {
                id: 'step-001',
                name: 'Clone from Gitea',
                command: 'git clone https://gitea.gmac.io/gmac/control-panel.git',
                status: 'success',
                duration: 5
              },
              {
                id: 'step-002',
                name: 'Checkout branch',
                command: 'git checkout main',
                status: 'success',
                duration: 2
              }
            ],
            startedAt: new Date(Date.now() - 30 * 60 * 1000),
            completedAt: new Date(Date.now() - 28 * 60 * 1000)
          },
          {
            id: 'stage-002',
            name: 'Drone CI Build',
            type: 'build',
            status: 'success',
            steps: [
              {
                id: 'step-003',
                name: 'Trigger Drone pipeline',
                command: 'drone build create gmac/control-panel',
                status: 'success',
                duration: 10
              },
              {
                id: 'step-004',
                name: 'Build Docker image',
                command: 'docker build -t control-panel:latest .',
                status: 'success',
                duration: 120
              },
              {
                id: 'step-005',
                name: 'Push to Harbor',
                command: 'docker push harbor.gmac.io/production/control-panel:v2.4.0',
                status: 'success',
                duration: 45
              }
            ],
            startedAt: new Date(Date.now() - 28 * 60 * 1000),
            completedAt: new Date(Date.now() - 24 * 60 * 1000)
          },
          {
            id: 'stage-003',
            name: 'Test & Security',
            type: 'test',
            status: 'success',
            steps: [
              {
                id: 'step-006',
                name: 'Unit tests',
                command: 'npm test',
                status: 'success',
                duration: 60
              },
              {
                id: 'step-007',
                name: 'Integration tests',
                command: 'npm run test:integration',
                status: 'success',
                duration: 180
              },
              {
                id: 'step-008',
                name: 'Harbor vulnerability scan',
                command: 'harbor scan harbor.gmac.io/production/control-panel:v2.4.0',
                status: 'success',
                duration: 45
              }
            ],
            startedAt: new Date(Date.now() - 24 * 60 * 1000),
            completedAt: new Date(Date.now() - 20 * 60 * 1000)
          },
          {
            id: 'stage-004',
            name: 'ArgoCD Staging Deploy',
            type: 'deploy',
            status: 'success',
            environment: 'staging',
            steps: [
              {
                id: 'step-009',
                name: 'Update ArgoCD application',
                command: 'argocd app set control-panel-staging --helm-set image.tag=v2.4.0',
                status: 'success',
                duration: 30
              },
              {
                id: 'step-010',
                name: 'Sync ArgoCD to K3s',
                command: 'argocd app sync control-panel-staging',
                status: 'success',
                duration: 60
              }
            ],
            startedAt: new Date(Date.now() - 20 * 60 * 1000),
            completedAt: new Date(Date.now() - 15 * 60 * 1000)
          },
          {
            id: 'stage-005',
            name: 'Production Deploy',
            type: 'deploy',
            status: 'running',
            environment: 'production',
            approvalRequired: true,
            steps: [
              {
                id: 'step-011',
                name: 'Update ArgoCD prod app',
                command: 'argocd app set control-panel-prod --helm-set image.tag=v2.4.0',
                status: 'running',
                duration: 15
              },
              {
                id: 'step-012',
                name: 'Blue-Green deploy to K3s',
                command: 'argocd app sync control-panel-prod --strategy blue-green',
                status: 'pending'
              }
            ],
            startedAt: new Date(Date.now() - 15 * 60 * 1000)
          }
        ],
        triggers: [
          {
            type: 'git-push',
            config: { 
              branch: 'main',
              giteaRepo: 'gmac/control-panel',
              webhookUrl: 'https://drone.gmac.io/hook'
            },
            enabled: true
          },
          {
            type: 'webhook',
            config: { 
              source: 'gitea',
              events: ['push', 'pull_request'],
              secret: 'webhook-secret-123'
            },
            enabled: true
          },
          {
            type: 'schedule',
            config: { 
              cron: '0 2 * * *',
              timezone: 'UTC'
            },
            enabled: false
          }
        ],
        approvals: [
          {
            stage: 'Production Deploy',
            type: 'manual',
            approvers: ['admin@gmac.io', 'ops@gmac.io'],
            minApprovals: 1,
            timeout: 60,
            conditions: ['staging_tests_passed', 'security_scan_clean']
          }
        ],
        status: 'running',
        lastRun: new Date(Date.now() - 30 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ];
  };

  const generateMockBlueGreenConfigs = (): BlueGreenConfig[] => {
    return [
      {
        id: 'bg-001',
        applicationId: 'app-001',
        applicationName: 'Control Panel API',
        blueEnvironment: {
          name: 'Blue (Production)',
          url: 'https://api.gmac.io',
          version: 'v2.3.1',
          replicas: 3,
          status: 'healthy',
          lastDeployed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          metrics: {
            requests: 125000,
            errors: 23,
            latency: 45,
            cpu: 35,
            memory: 62
          }
        },
        greenEnvironment: {
          name: 'Green (Staging)',
          url: 'https://api-staging.gmac.io',
          version: 'v2.4.0',
          replicas: 3,
          status: 'healthy',
          lastDeployed: new Date(Date.now() - 2 * 60 * 60 * 1000),
          metrics: {
            requests: 8500,
            errors: 2,
            latency: 42,
            cpu: 38,
            memory: 65
          }
        },
        activeEnvironment: 'blue',
        trafficDistribution: {
          blue: 95,
          green: 5
        },
        healthChecks: [
          {
            name: 'K3s Pod Health',
            type: 'http',
            endpoint: '/health',
            interval: 30,
            timeout: 5,
            successThreshold: 2,
            failureThreshold: 3,
            status: 'passing',
            lastCheck: new Date(Date.now() - 30 * 1000)
          },
          {
            name: 'ArgoCD Sync Status',
            type: 'custom',
            endpoint: 'argocd-server.argocd.svc.cluster.local:443/api/v1/applications',
            interval: 60,
            timeout: 10,
            successThreshold: 1,
            failureThreshold: 2,
            status: 'passing',
            lastCheck: new Date(Date.now() - 45 * 1000)
          },
          {
            name: 'Harbor Image Scan',
            type: 'http',
            endpoint: 'https://harbor.gmac.io/api/v2.0/projects/production/repositories',
            interval: 300,
            timeout: 15,
            successThreshold: 1,
            failureThreshold: 1,
            status: 'passing',
            lastCheck: new Date(Date.now() - 120 * 1000)
          },
          {
            name: 'Gitea Repository Access',
            type: 'http',
            endpoint: 'https://gitea.gmac.io/api/v1/repos/gmac/control-panel',
            interval: 300,
            timeout: 10,
            successThreshold: 1,
            failureThreshold: 2,
            status: 'passing',
            lastCheck: new Date(Date.now() - 180 * 1000)
          }
        ],
        switchStrategy: 'gradual',
        rollbackThreshold: 5
      }
    ];
  };

  const generateMockCanaryConfigs = (): CanaryConfig[] => {
    return [
      {
        id: 'canary-001',
        applicationId: 'app-002',
        applicationName: 'Frontend Application',
        baselineVersion: 'v1.8.3',
        canaryVersion: 'v1.9.0',
        trafficPercentage: 10,
        stages: [
          {
            percentage: 5,
            duration: 30,
            metrics: ['error_rate', 'latency'],
            successCriteria: {
              error_rate: '< 1%',
              latency: '< 100ms'
            }
          },
          {
            percentage: 25,
            duration: 60,
            metrics: ['error_rate', 'latency', 'throughput'],
            successCriteria: {
              error_rate: '< 1%',
              latency: '< 100ms',
              throughput: '> 1000 rps'
            }
          },
          {
            percentage: 50,
            duration: 120,
            metrics: ['error_rate', 'latency', 'throughput'],
            successCriteria: {
              error_rate: '< 1%',
              latency: '< 100ms',
              throughput: '> 1000 rps'
            }
          }
        ],
        metrics: [
          {
            name: 'Error Rate',
            type: 'error_rate',
            baseline: 0.5,
            current: 0.3,
            threshold: 1.0,
            status: 'healthy'
          },
          {
            name: 'P99 Latency',
            type: 'latency',
            baseline: 85,
            current: 78,
            threshold: 100,
            status: 'healthy'
          },
          {
            name: 'Throughput',
            type: 'throughput',
            baseline: 1200,
            current: 1350,
            threshold: 1000,
            status: 'healthy'
          }
        ],
        autoPromote: true,
        autoRollback: true,
        status: 'running'
      }
    ];
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'high': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Rocket className="h-8 w-8 text-blue-500" />
            Advanced Deployments
          </h1>
          <p className="text-gray-400 mt-1">
            Sophisticated deployment strategies with zero-downtime releases
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Start Deployment
          </Button>
        </div>
      </div>

      {/* Integration Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-green-400">●</p>
              <p className="text-sm text-gray-400">Gitea Connected</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-400">●</p>
              <p className="text-sm text-gray-400">Drone CI</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-green-400">●</p>
              <p className="text-sm text-gray-400">Harbor Registry</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <GitMerge className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-green-400">●</p>
              <p className="text-sm text-gray-400">ArgoCD</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Server className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-green-400">●</p>
              <p className="text-sm text-gray-400">K3s Cluster</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Deployment Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{pipelines.length}</p>
              <p className="text-sm text-gray-400">Active Pipelines</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shuffle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{blueGreenConfigs.length}</p>
              <p className="text-sm text-gray-400">Blue-Green Deployments</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">99.9%</p>
              <p className="text-sm text-gray-400">Success Rate</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">2.5m</p>
              <p className="text-sm text-gray-400">Avg Deploy Time</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="strategies">Deployment Strategies</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="blue-green">Blue-Green</TabsTrigger>
          <TabsTrigger value="canary">Canary Release</TabsTrigger>
          <TabsTrigger value="rollback">Rollback</TabsTrigger>
        </TabsList>

        <TabsContent value="strategies" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Choose Deployment Strategy</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deploymentStrategies.map(strategy => (
                <Card 
                  key={strategy.id} 
                  className={`p-4 cursor-pointer transition-all hover:border-blue-500 ${
                    selectedStrategy?.id === strategy.id ? 'border-blue-500 bg-blue-500/10' : ''
                  }`}
                  onClick={() => setSelectedStrategy(strategy)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-800">
                      {strategy.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{strategy.name}</h3>
                        {strategy.recommended && (
                          <Badge variant="default" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{strategy.description}</p>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Risk Level</span>
                          <Badge variant="outline" className={getRiskLevelColor(strategy.riskLevel)}>
                            {strategy.riskLevel}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Rollback Time</span>
                          <span>{strategy.rollbackTime}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Downtime</span>
                          <span className={strategy.downtime === 'Zero' ? 'text-green-400' : ''}>
                            {strategy.downtime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {selectedStrategy && (
              <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {selectedStrategy.name} Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">When to Use</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Minimal risk tolerance required</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Need instant rollback capability</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Testing in production environment</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Configuration</h4>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure {selectedStrategy.name}
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <FileCheck className="h-4 w-4 mr-2" />
                        View Documentation
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4">
          <DeploymentPipeline 
            pipelines={pipelines}
            onCreatePipeline={(pipeline) => {
              console.log('Create pipeline:', pipeline);
            }}
            onUpdatePipeline={(pipelineId, updates) => {
              console.log('Update pipeline:', pipelineId, updates);
            }}
            onRunPipeline={(pipelineId) => {
              console.log('Run pipeline:', pipelineId);
            }}
          />
        </TabsContent>

        <TabsContent value="blue-green" className="space-y-4">
          <BlueGreenDeployment 
            configs={blueGreenConfigs}
            onSwitchEnvironment={(configId, target) => {
              console.log('Switch environment:', configId, target);
            }}
            onUpdateTraffic={(configId, distribution) => {
              console.log('Update traffic:', configId, distribution);
            }}
          />
        </TabsContent>

        <TabsContent value="canary" className="space-y-4">
          <CanaryRelease 
            configs={canaryConfigs}
            onPromoteCanary={(configId) => {
              console.log('Promote canary:', configId);
            }}
            onRollbackCanary={(configId) => {
              console.log('Rollback canary:', configId);
            }}
            onUpdateTraffic={(configId, percentage) => {
              console.log('Update canary traffic:', configId, percentage);
            }}
          />
        </TabsContent>

        <TabsContent value="rollback" className="space-y-4">
          <RollbackManager 
            onRollback={(deploymentId, targetVersion) => {
              console.log('Rollback deployment:', deploymentId, targetVersion);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}