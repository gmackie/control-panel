'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UnifiedApplicationDashboard } from '@/components/monitoring/UnifiedApplicationDashboard';
import { RealTimeMetrics } from '@/components/monitoring/RealTimeMetrics';
import { LogAggregation } from '@/components/monitoring/LogAggregation';
import { PerformanceAnalytics } from '@/components/monitoring/PerformanceAnalytics';
import { ApplicationMonitoring } from '@/lib/monitoring/application-monitor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Server, Layers, RefreshCw, BarChart3, Terminal, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MonitoringData {
  applications: ApplicationMonitoring[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    critical: number;
    unknown: number;
    totalPods: number;
    runningPods: number;
    totalRestarts: number;
  };
  lastUpdate: string;
  cluster: string;
  namespace: string;
}

interface ServiceHealth {
  id: string;
  name: string;
  type: string;
  status: 'healthy' | 'degraded' | 'down' | 'maintenance';
  uptime: number;
  responseTime: number;
  errorRate: number;
  lastChecked: string;
  environment: string;
  throughput?: number;
  dependencies?: string[];
  version?: string;
}

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
  history: { timestamp: Date; value: number }[];
}



export default function MonitoringPage() {
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [selectedNamespace, setSelectedNamespace] = useState('default');
  const [timeRange, setTimeRange] = useState('1h');

  const { data: monitoringData, isLoading: monitoringLoading, refetch: refetchMonitoring } = useQuery<MonitoringData>({
    queryKey: ['monitoring', 'applications', selectedCluster, selectedNamespace],
    queryFn: async () => {
      const params = new URLSearchParams({
        cluster: selectedCluster,
        namespace: selectedNamespace,
      });
      const response = await fetch(`/api/monitoring/applications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch monitoring data');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: servicesData, isLoading: servicesLoading, refetch: refetchServices } = useQuery<{ services: ServiceHealth[] }>({
    queryKey: ['monitoring', 'services'],
    queryFn: async () => {
      const response = await fetch('/api/health/services');
      if (!response.ok) throw new Error('Failed to fetch services');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: metricsData, refetch: refetchMetrics } = useQuery<SystemMetric[]>({
    queryKey: ['monitoring', 'metrics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/metrics?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      return data.metrics || [];
    },
    refetchInterval: 10000,
  });

  const handleRefreshAll = () => {
    refetchMonitoring();
    refetchServices();
    refetchMetrics();
  };

  const services = servicesData?.services || [];
  const metrics = metricsData || [];

  const healthyServices = services.filter(s => s.status === 'healthy').length;

  // Convert services to PerformanceAnalytics format
  const performanceServices = services.map(s => ({
    id: s.id,
    name: s.name,
    status: s.status === 'down' ? 'unhealthy' as const : s.status === 'maintenance' ? 'degraded' as const : s.status as 'healthy' | 'degraded',
    uptime: s.uptime,
    responseTime: s.responseTime,
    errorRate: s.errorRate,
    throughput: s.throughput || Math.floor(Math.random() * 500) + 100,
    lastCheck: new Date(s.lastChecked),
    dependencies: s.dependencies || [],
    version: s.version || '1.0.0',
    environment: s.environment
  }));

  const logSources = ['k3s-cluster', 'api-gateway', 'database', 'gitea', 'harbor', 'control-panel'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'down': return 'error';
      default: return 'secondary';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Monitoring</h1>
          <p className="text-gray-400">
            Application and service health monitoring
          </p>
        </div>
        <Button onClick={handleRefreshAll}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Applications</p>
              <p className="text-2xl font-bold">
                {monitoringData?.summary.healthy || 0}/{monitoringData?.summary.total || 0}
              </p>
            </div>
            <Layers className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Services</p>
              <p className="text-2xl font-bold">
                {healthyServices}/{services.length}
              </p>
            </div>
            <Server className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Pods Running</p>
              <p className="text-2xl font-bold">
                {monitoringData?.summary.runningPods || 0}/{monitoringData?.summary.totalPods || 0}
              </p>
            </div>
            <Activity className="h-8 w-8 text-cyan-500" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Real-time Metrics
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          {monitoringLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : monitoringData ? (
            <UnifiedApplicationDashboard 
              applications={monitoringData.applications}
              onRefresh={() => refetchMonitoring()}
            />
          ) : (
            <Card className="p-12 text-center">
              <Layers className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No application data available</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          {servicesLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <Card key={service.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{service.name}</h3>
                      <p className="text-xs text-gray-500">{service.type} • {service.environment}</p>
                    </div>
                    <Badge variant={getStatusBadge(service.status) as any}>
                      {service.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Uptime</span>
                      <span className="font-medium">{service.uptime.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Response Time</span>
                      <span className="font-medium">{service.responseTime}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Error Rate</span>
                      <span className="font-medium">{service.errorRate.toFixed(2)}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Last checked: {formatDistanceToNow(new Date(service.lastChecked))} ago
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Services Configured</h3>
              <p className="text-gray-400">Configure services to start monitoring</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="metrics">
          <RealTimeMetrics 
            metrics={metrics}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </TabsContent>

        <TabsContent value="logs">
          <LogAggregation 
            sources={logSources}
            timeRange={timeRange}
          />
        </TabsContent>

        <TabsContent value="performance">
          {servicesLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : performanceServices.length > 0 ? (
            <PerformanceAnalytics 
              services={performanceServices}
              timeRange={timeRange}
            />
          ) : (
            <Card className="p-12 text-center">
              <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Performance Data</h3>
              <p className="text-gray-400">Service data is required for performance analytics</p>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
