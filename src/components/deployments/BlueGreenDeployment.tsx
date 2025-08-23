"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { 
  Shuffle,
  Plus,
  Activity,
  Globe,
  Server,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Zap,
  Shield,
  Users,
  Target,
  BarChart3,
  Clock,
  Heart,
  Settings,
  GitMerge,
  Package,
  ExternalLink,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Layers
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  argoApp?: string;
  k8sNamespace?: string;
  harborImage?: string;
}

interface HealthCheck {
  name: string;
  type: 'http' | 'tcp' | 'grpc' | 'custom';
  endpoint: string;
  interval: number;
  timeout: number;
  successThreshold: number;
  failureThreshold: number;
  status: 'passing' | 'warning' | 'failing';
  lastCheck: Date;
}

interface BlueGreenDeploymentProps {
  configs: BlueGreenConfig[];
  onSwitchEnvironment: (configId: string, target: 'blue' | 'green') => void;
  onUpdateTraffic: (configId: string, distribution: { blue: number; green: number }) => void;
}

export function BlueGreenDeployment({ 
  configs, 
  onSwitchEnvironment, 
  onUpdateTraffic 
}: BlueGreenDeploymentProps) {
  const [selectedConfig, setSelectedConfig] = useState<BlueGreenConfig | null>(null);
  const [trafficSlider, setTrafficSlider] = useState<{ [key: string]: number }>({});

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'degraded':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'unhealthy':
        return 'bg-red-500/20 text-red-400 border-red-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getHealthCheckIcon = (status: string) => {
    switch (status) {
      case 'passing':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'failing':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const handleTrafficUpdate = (config: BlueGreenConfig, bluePercentage: number) => {
    const greenPercentage = 100 - bluePercentage;
    onUpdateTraffic(config.id, {
      blue: bluePercentage,
      green: greenPercentage
    });
  };

  const getEnvironmentIcon = (envName: string, isActive: boolean) => {
    const baseClasses = "h-6 w-6";
    if (envName.toLowerCase().includes('blue')) {
      return <Server className={`${baseClasses} ${isActive ? 'text-blue-400' : 'text-blue-600/50'}`} />;
    } else {
      return <Server className={`${baseClasses} ${isActive ? 'text-green-400' : 'text-green-600/50'}`} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-blue-500" />
          Blue-Green Deployments
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Blue-Green
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {configs.map(config => (
          <Card key={config.id} className="p-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{config.applicationName}</h3>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      Active: {config.activeEnvironment}
                    </Badge>
                    <Badge variant="secondary">
                      Strategy: {config.switchStrategy}
                    </Badge>
                    <span className="text-sm text-gray-400">
                      Rollback threshold: {config.rollbackThreshold}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedConfig(selectedConfig?.id === config.id ? null : config)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {selectedConfig?.id === config.id ? 'Hide' : 'Details'}
                  </Button>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Environment Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Blue Environment */}
                <Card className={`p-4 ${config.activeEnvironment === 'blue' ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getEnvironmentIcon('blue', config.activeEnvironment === 'blue')}
                      <div>
                        <h4 className="font-semibold text-blue-400">{config.blueEnvironment.name}</h4>
                        <p className="text-sm text-gray-400">v{config.blueEnvironment.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getStatusColor(config.blueEnvironment.status)}>
                        {getStatusIcon(config.blueEnvironment.status)}
                        {config.blueEnvironment.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">URL</span>
                      <a href={config.blueEnvironment.url} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        {config.blueEnvironment.url.replace('https://', '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Replicas</span>
                      <span>{config.blueEnvironment.replicas}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Traffic</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-blue-400">{config.trafficDistribution.blue}%</span>
                        <div className={`w-2 h-2 rounded-full ${config.activeEnvironment === 'blue' ? 'bg-blue-400' : 'bg-gray-600'}`}></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last Deployed</span>
                      <span>{formatDistanceToNow(config.blueEnvironment.lastDeployed, { addSuffix: true })}</span>
                    </div>

                    {config.blueEnvironment.metrics && (
                      <div className="pt-3 border-t border-gray-800">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Requests</span>
                            <span>{config.blueEnvironment.metrics.requests.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Errors</span>
                            <span className={config.blueEnvironment.metrics.errors > 50 ? 'text-red-400' : 'text-green-400'}>
                              {config.blueEnvironment.metrics.errors}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Latency</span>
                            <span>{config.blueEnvironment.metrics.latency}ms</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">CPU</span>
                            <span>{config.blueEnvironment.metrics.cpu}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button 
                      variant={config.activeEnvironment === 'blue' ? 'default' : 'outline'} 
                      size="sm"
                      className="flex-1"
                      onClick={() => onSwitchEnvironment(config.id, 'blue')}
                      disabled={config.activeEnvironment === 'blue'}
                    >
                      {config.activeEnvironment === 'blue' ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <ArrowLeft className="h-4 w-4 mr-1" />
                          Switch
                        </>
                      )}
                    </Button>
                  </div>
                </Card>

                {/* Green Environment */}
                <Card className={`p-4 ${config.activeEnvironment === 'green' ? 'border-green-500 bg-green-500/5' : 'border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getEnvironmentIcon('green', config.activeEnvironment === 'green')}
                      <div>
                        <h4 className="font-semibold text-green-400">{config.greenEnvironment.name}</h4>
                        <p className="text-sm text-gray-400">v{config.greenEnvironment.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getStatusColor(config.greenEnvironment.status)}>
                        {getStatusIcon(config.greenEnvironment.status)}
                        {config.greenEnvironment.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">URL</span>
                      <a href={config.greenEnvironment.url} className="text-green-400 hover:text-green-300 flex items-center gap-1">
                        {config.greenEnvironment.url.replace('https://', '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Replicas</span>
                      <span>{config.greenEnvironment.replicas}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Traffic</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-green-400">{config.trafficDistribution.green}%</span>
                        <div className={`w-2 h-2 rounded-full ${config.activeEnvironment === 'green' ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last Deployed</span>
                      <span>{formatDistanceToNow(config.greenEnvironment.lastDeployed, { addSuffix: true })}</span>
                    </div>

                    {config.greenEnvironment.metrics && (
                      <div className="pt-3 border-t border-gray-800">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Requests</span>
                            <span>{config.greenEnvironment.metrics.requests.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Errors</span>
                            <span className={config.greenEnvironment.metrics.errors > 50 ? 'text-red-400' : 'text-green-400'}>
                              {config.greenEnvironment.metrics.errors}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Latency</span>
                            <span>{config.greenEnvironment.metrics.latency}ms</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">CPU</span>
                            <span>{config.greenEnvironment.metrics.cpu}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button 
                      variant={config.activeEnvironment === 'green' ? 'default' : 'outline'} 
                      size="sm"
                      className="flex-1"
                      onClick={() => onSwitchEnvironment(config.id, 'green')}
                      disabled={config.activeEnvironment === 'green'}
                    >
                      {config.activeEnvironment === 'green' ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Switch
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Traffic Distribution Control */}
              <Card className="p-4">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Traffic Distribution
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-400">Blue: {config.trafficDistribution.blue}%</span>
                    <span className="text-green-400">Green: {config.trafficDistribution.green}%</span>
                  </div>
                  
                  <div className="relative">
                    <Progress 
                      value={config.trafficDistribution.blue} 
                      className="h-4"
                    />
                    <div className="absolute inset-0 flex">
                      <div 
                        className="bg-blue-500 h-4 rounded-l"
                        style={{ width: `${config.trafficDistribution.blue}%` }}
                      />
                      <div 
                        className="bg-green-500 h-4 rounded-r"
                        style={{ width: `${config.trafficDistribution.green}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Slider
                      value={[trafficSlider[config.id] ?? config.trafficDistribution.blue]}
                      onValueChange={(value) => setTrafficSlider({...trafficSlider, [config.id]: value[0]})}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <Button 
                      size="sm"
                      onClick={() => handleTrafficUpdate(config, trafficSlider[config.id] ?? config.trafficDistribution.blue)}
                      disabled={!trafficSlider[config.id] || trafficSlider[config.id] === config.trafficDistribution.blue}
                    >
                      Apply
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleTrafficUpdate(config, 100)}>
                      100% Blue
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleTrafficUpdate(config, 50)}>
                      50/50 Split
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleTrafficUpdate(config, 0)}>
                      100% Green
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Health Checks */}
              <Card className="p-4">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Health Checks
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {config.healthChecks.map(check => (
                    <div key={check.name} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getHealthCheckIcon(check.status)}
                        <div>
                          <p className="text-sm font-medium">{check.name}</p>
                          <p className="text-xs text-gray-400">
                            {check.type.toUpperCase()} • {check.interval}s interval
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={getStatusColor(check.status === 'passing' ? 'healthy' : check.status === 'warning' ? 'degraded' : 'unhealthy')}>
                          {check.status}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(check.lastCheck, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Expanded Details */}
              {selectedConfig?.id === config.id && (
                <Card className="p-4 bg-gray-900/30">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Deployment Details
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-sm font-medium text-gray-400 mb-3">Blue Environment</h5>
                      <div className="space-y-2 text-sm">
                        {config.blueEnvironment.argoApp && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">ArgoCD App</span>
                            <Button variant="ghost" size="sm" className="h-auto p-0">
                              <GitMerge className="h-3 w-3 mr-1" />
                              {config.blueEnvironment.argoApp}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                        {config.blueEnvironment.k8sNamespace && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">K8s Namespace</span>
                            <span>{config.blueEnvironment.k8sNamespace}</span>
                          </div>
                        )}
                        {config.blueEnvironment.harborImage && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Harbor Image</span>
                            <Button variant="ghost" size="sm" className="h-auto p-0">
                              <Package className="h-3 w-3 mr-1" />
                              View
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-400 mb-3">Green Environment</h5>
                      <div className="space-y-2 text-sm">
                        {config.greenEnvironment.argoApp && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">ArgoCD App</span>
                            <Button variant="ghost" size="sm" className="h-auto p-0">
                              <GitMerge className="h-3 w-3 mr-1" />
                              {config.greenEnvironment.argoApp}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                        {config.greenEnvironment.k8sNamespace && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">K8s Namespace</span>
                            <span>{config.greenEnvironment.k8sNamespace}</span>
                          </div>
                        )}
                        {config.greenEnvironment.harborImage && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Harbor Image</span>
                            <Button variant="ghost" size="sm" className="h-auto p-0">
                              <Package className="h-3 w-3 mr-1" />
                              View
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Rollback
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                    <Button variant="outline" size="sm">
                      <Activity className="h-4 w-4 mr-1" />
                      View Logs
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </Card>
        ))}

        {configs.length === 0 && (
          <Card className="p-8 text-center">
            <Shuffle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Blue-Green Deployments</h3>
            <p className="text-gray-500 mb-4">
              Set up blue-green deployments for zero-downtime releases with instant rollback capabilities.
            </p>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Create Blue-Green Deployment
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}