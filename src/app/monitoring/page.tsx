"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  Server,
  Database,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Settings,
  RefreshCw,
  Download,
  Filter,
  Search,
  Layers,
  Target,
  Shield,
  Heart,
  Cpu,
  HardDrive,
  Network,
  MemoryStick,
  Timer,
  Users,
  Package,
  GitBranch,
  Bell
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RealTimeMetrics } from "@/components/monitoring/RealTimeMetrics";
import { PerformanceAnalytics } from "@/components/monitoring/PerformanceAnalytics";
import { LogAggregation } from "@/components/monitoring/LogAggregation";
import { APMDashboard } from "@/components/monitoring/APMDashboard";
import { CustomDashboards } from "@/components/monitoring/CustomDashboards";

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  status: 'healthy' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
  lastUpdated: Date;
  source: string;
  history?: Array<{ timestamp: Date; value: number }>;
}

interface ServiceHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastCheck: Date;
  dependencies: string[];
  version: string;
  environment: string;
}

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  source: string;
  timestamp: Date;
  affectedServices: string[];
}

interface InfrastructureMetrics {
  kubernetes: {
    nodes: number;
    pods: number;
    services: number;
    deployments: number;
    cpuUsage: number;
    memoryUsage: number;
    networkIO: number;
    storageUsage: number;
  };
  applications: {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    activeUsers: number;
  };
  integrations: {
    gitea: { status: 'healthy' | 'unhealthy'; responseTime: number };
    drone: { status: 'healthy' | 'unhealthy'; activeJobs: number };
    harbor: { status: 'healthy' | 'unhealthy'; imageCount: number };
    argocd: { status: 'healthy' | 'unhealthy'; syncedApps: number };
  };
}

export default function MonitoringPage() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [infraMetrics, setInfraMetrics] = useState<InfrastructureMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const [metricsRes, healthRes, alertsRes, infraRes] = await Promise.all([
        fetch('/api/monitoring/metrics'),
        fetch('/api/monitoring/health'),
        fetch('/api/monitoring/alerts'),
        fetch('/api/monitoring/infrastructure')
      ]);

      const metrics = await metricsRes.json();
      const health = await healthRes.json();
      const alertsData = await alertsRes.json();
      const infra = await infraRes.json();

      setSystemMetrics(metrics.metrics || generateMockMetrics());
      setServiceHealth(health.services || generateMockServiceHealth());
      setAlerts(alertsData.alerts || generateMockAlerts());
      setInfraMetrics(infra.infrastructure || generateMockInfraMetrics());
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      // Use mock data as fallback
      setSystemMetrics(generateMockMetrics());
      setServiceHealth(generateMockServiceHealth());
      setAlerts(generateMockAlerts());
      setInfraMetrics(generateMockInfraMetrics());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitoringData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchMonitoringData]);

  const generateMockMetrics = (): SystemMetric[] => {
    const now = new Date();
    return [
      {
        id: 'cpu',
        name: 'CPU Usage',
        value: 68.5,
        unit: '%',
        change: 2.3,
        status: 'healthy',
        threshold: { warning: 80, critical: 90 },
        lastUpdated: now,
        source: 'k3s-cluster'
      },
      {
        id: 'memory',
        name: 'Memory Usage',
        value: 76.2,
        unit: '%',
        change: -1.1,
        status: 'healthy',
        threshold: { warning: 80, critical: 90 },
        lastUpdated: now,
        source: 'k3s-cluster'
      },
      {
        id: 'disk',
        name: 'Disk Usage',
        value: 45.8,
        unit: '%',
        change: 0.5,
        status: 'healthy',
        threshold: { warning: 80, critical: 90 },
        lastUpdated: now,
        source: 'k3s-cluster'
      },
      {
        id: 'network',
        name: 'Network I/O',
        value: 125.3,
        unit: 'MB/s',
        change: 12.7,
        status: 'healthy',
        threshold: { warning: 500, critical: 800 },
        lastUpdated: now,
        source: 'k3s-cluster'
      },
      {
        id: 'response-time',
        name: 'Avg Response Time',
        value: 142,
        unit: 'ms',
        change: -8,
        status: 'healthy',
        threshold: { warning: 500, critical: 1000 },
        lastUpdated: now,
        source: 'api-gateway'
      },
      {
        id: 'error-rate',
        name: 'Error Rate',
        value: 0.8,
        unit: '%',
        change: 0.2,
        status: 'healthy',
        threshold: { warning: 2, critical: 5 },
        lastUpdated: now,
        source: 'api-gateway'
      }
    ];
  };

  const generateMockServiceHealth = (): ServiceHealth[] => {
    const now = new Date();
    return [
      {
        id: 'control-panel-api',
        name: 'Control Panel API',
        status: 'healthy',
        uptime: 99.94,
        responseTime: 142,
        errorRate: 0.8,
        throughput: 1250,
        lastCheck: now,
        dependencies: ['database', 'redis'],
        version: 'v2.4.0',
        environment: 'production'
      },
      {
        id: 'gitea-server',
        name: 'Gitea Server',
        status: 'healthy',
        uptime: 99.98,
        responseTime: 89,
        errorRate: 0.1,
        throughput: 324,
        lastCheck: now,
        dependencies: ['database'],
        version: 'v1.20.4',
        environment: 'production'
      },
      {
        id: 'drone-ci',
        name: 'Drone CI',
        status: 'healthy',
        uptime: 99.85,
        responseTime: 234,
        errorRate: 0.3,
        throughput: 156,
        lastCheck: now,
        dependencies: ['gitea-server', 'database'],
        version: 'v2.16.0',
        environment: 'production'
      },
      {
        id: 'harbor-registry',
        name: 'Harbor Registry',
        status: 'healthy',
        uptime: 99.91,
        responseTime: 195,
        errorRate: 0.5,
        throughput: 412,
        lastCheck: now,
        dependencies: ['database', 'storage'],
        version: 'v2.9.0',
        environment: 'production'
      },
      {
        id: 'argocd',
        name: 'ArgoCD',
        status: 'degraded',
        uptime: 98.76,
        responseTime: 456,
        errorRate: 1.2,
        throughput: 89,
        lastCheck: now,
        dependencies: ['k3s-cluster'],
        version: 'v2.8.4',
        environment: 'production'
      },
      {
        id: 'database',
        name: 'PostgreSQL Database',
        status: 'healthy',
        uptime: 99.99,
        responseTime: 23,
        errorRate: 0.0,
        throughput: 2840,
        lastCheck: now,
        dependencies: [],
        version: 'v15.4',
        environment: 'production'
      }
    ];
  };

  const generateMockAlerts = (): Alert[] => {
    const now = new Date();
    return [
      {
        id: 'alert-001',
        title: 'High Response Time Detected',
        description: 'ArgoCD response time exceeded 400ms threshold for 5 minutes',
        severity: 'warning',
        status: 'active',
        source: 'prometheus',
        timestamp: new Date(now.getTime() - 15 * 60 * 1000),
        affectedServices: ['argocd']
      },
      {
        id: 'alert-002',
        title: 'Disk Space Warning',
        description: 'K3s node storage usage above 80%',
        severity: 'warning',
        status: 'acknowledged',
        source: 'node-exporter',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000),
        affectedServices: ['k3s-cluster']
      },
      {
        id: 'alert-003',
        title: 'SSL Certificate Renewal',
        description: 'SSL certificate for *.gmac.io expires in 14 days',
        severity: 'info',
        status: 'active',
        source: 'cert-manager',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        affectedServices: ['api-gateway']
      }
    ];
  };

  const generateMockInfraMetrics = (): InfrastructureMetrics => {
    return {
      kubernetes: {
        nodes: 4,
        pods: 47,
        services: 23,
        deployments: 18,
        cpuUsage: 68.5,
        memoryUsage: 76.2,
        networkIO: 125.3,
        storageUsage: 45.8
      },
      applications: {
        totalRequests: 145620,
        errorRate: 0.8,
        avgResponseTime: 142,
        activeUsers: 1247
      },
      integrations: {
        gitea: { status: 'healthy', responseTime: 89 },
        drone: { status: 'healthy', activeJobs: 3 },
        harbor: { status: 'healthy', imageCount: 156 },
        argocd: { status: 'healthy', syncedApps: 12 }
      }
    };
  };

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getServiceStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'info': return 'bg-blue-500/20 text-blue-400 border-blue-500';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500';
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
            <Activity className="h-8 w-8 text-green-500" />
            Real-Time Monitoring
          </h1>
          <p className="text-gray-400 mt-1">
            Comprehensive monitoring and analytics for your infrastructure and applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </Button>
          </div>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
          </select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {systemMetrics.slice(0, 6).map(metric => (
          <Card key={metric.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{metric.name}</span>
              <div className={`flex items-center gap-1 text-xs ${
                metric.change > 0 ? 'text-red-400' : 'text-green-400'
              }`}>
                {metric.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(metric.change)}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-2xl font-bold ${getMetricStatusColor(metric.status)}`}>
                  {metric.value}{metric.unit}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(metric.lastUpdated, { addSuffix: true })}
                </p>
              </div>
              <Progress 
                value={(metric.value / metric.threshold.critical) * 100} 
                className="w-8 h-8 rotate-90"
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Infrastructure Overview */}
      {infraMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Server className="h-6 w-6 text-blue-500" />
              <h3 className="font-semibold">Kubernetes Cluster</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Nodes</span>
                <span>{infraMetrics.kubernetes.nodes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pods</span>
                <span>{infraMetrics.kubernetes.pods}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Services</span>
                <span>{infraMetrics.kubernetes.services}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Deployments</span>
                <span>{infraMetrics.kubernetes.deployments}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="h-6 w-6 text-green-500" />
              <h3 className="font-semibold">Applications</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Requests</span>
                <span>{infraMetrics.applications.totalRequests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Error Rate</span>
                <span className="text-green-400">{infraMetrics.applications.errorRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Response</span>
                <span>{infraMetrics.applications.avgResponseTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Users</span>
                <span>{infraMetrics.applications.activeUsers.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Package className="h-6 w-6 text-purple-500" />
              <h3 className="font-semibold">Integrations</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(infraMetrics.integrations).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 capitalize">{key}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      value.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className="text-xs">
                      {'responseTime' in value ? `${value.responseTime}ms` :
                       'activeJobs' in value ? `${value.activeJobs} jobs` :
                       'imageCount' in value ? `${value.imageCount} images` :
                       'syncedApps' in value ? `${value.syncedApps} apps` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Bell className="h-6 w-6 text-yellow-500" />
              <h3 className="font-semibold">Active Alerts</h3>
            </div>
            <div className="space-y-2">
              {alerts.filter(a => a.status === 'active').slice(0, 3).map(alert => (
                <div key={alert.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      alert.severity === 'critical' ? 'bg-red-400' :
                      alert.severity === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                    }`}></div>
                    <span className="truncate">{alert.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-4 truncate">
                    {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                  </p>
                </div>
              ))}
              {alerts.filter(a => a.status === 'active').length === 0 && (
                <p className="text-sm text-green-400">All systems operational</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">System Overview</TabsTrigger>
          <TabsTrigger value="metrics">Real-Time Metrics</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
          <TabsTrigger value="logs">Log Aggregation</TabsTrigger>
          <TabsTrigger value="apm">APM</TabsTrigger>
          <TabsTrigger value="dashboards">Custom Dashboards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Service Health Status */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Service Health Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {serviceHealth.map(service => (
                <Card key={service.id} className="p-4 border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getServiceStatusIcon(service.status)}
                      <h3 className="font-semibold">{service.name}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {service.environment}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Uptime</span>
                      <span className="text-green-400">{service.uptime}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Response Time</span>
                      <span>{service.responseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Error Rate</span>
                      <span className={service.errorRate > 1 ? 'text-red-400' : 'text-green-400'}>
                        {service.errorRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Throughput</span>
                      <span>{service.throughput} req/min</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Version {service.version}</span>
                      <span className="text-gray-500">
                        {formatDistanceToNow(service.lastCheck, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Recent Alerts */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Recent Alerts
              </h2>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View All
              </Button>
            </div>
            
            <div className="space-y-3">
              {alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="flex items-start gap-4 p-3 bg-gray-900/50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full mt-1 ${
                    alert.severity === 'critical' ? 'bg-red-500' :
                    alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}></div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{alert.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getAlertSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <Badge variant={alert.status === 'active' ? 'error' : 'secondary'} className="text-xs">
                          {alert.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-2">{alert.description}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Source: {alert.source}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(alert.timestamp, { addSuffix: true })}</span>
                      {alert.affectedServices.length > 0 && (
                        <>
                          <span>•</span>
                          <span>Services: {alert.affectedServices.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <RealTimeMetrics 
            metrics={systemMetrics as any}
            timeRange={selectedTimeRange}
            onTimeRangeChange={setSelectedTimeRange}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <PerformanceAnalytics 
            services={serviceHealth}
            timeRange={selectedTimeRange}
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogAggregation 
            sources={['k3s-cluster', 'api-gateway', 'database']}
            timeRange={selectedTimeRange}
          />
        </TabsContent>

        <TabsContent value="apm" className="space-y-4">
          <APMDashboard 
            applications={serviceHealth.filter(s => s.environment === 'production')}
          />
        </TabsContent>

        <TabsContent value="dashboards" className="space-y-4">
          <CustomDashboards />
        </TabsContent>
      </Tabs>
    </div>
  );
}