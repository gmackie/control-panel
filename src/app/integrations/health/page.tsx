"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield,
  Server,
  Database,
  Mail,
  MessageSquare,
  CreditCard,
  Brain,
  Mic,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Info,
  BarChart3,
  Settings,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface IntegrationHealth {
  provider: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'checking';
  uptime: number;
  lastCheck: string;
  responseTime: number;
  errorRate: number;
  metrics: {
    requests?: number;
    errors?: number;
    latency?: number;
    usage?: number;
    limit?: number;
  };
  incidents: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
  endpoints: Array<{
    name: string;
    url: string;
    status: 'up' | 'down';
    responseTime: number;
    lastCheck: string;
  }>;
}

interface HealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  avgUptime: number;
  avgResponseTime: number;
  totalRequests: number;
  totalErrors: number;
}

export default function IntegrationHealthPage() {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: healthData, isLoading, refetch } = useQuery<{
    summary: HealthSummary;
    integrations: IntegrationHealth[];
  }>({
    queryKey: ["integration-health", timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/health?range=${timeRange}`);
      if (!response.ok) throw new Error("Failed to fetch health data");
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getIntegrationIcon = (provider: string) => {
    const icons: Record<string, any> = {
      stripe: CreditCard,
      turso: Database,
      supabase: Database,
      elevenlabs: Mic,
      openrouter: Brain,
      sendgrid: Mail,
      twilio: MessageSquare,
      clerk: Shield,
      aws: Server,
    };
    return icons[provider] || Zap;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatUptime = (uptime: number) => {
    if (uptime >= 99.9) return '99.9%';
    return `${uptime.toFixed(2)}%`;
  };

  const formatResponseTime = (time: number) => {
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integration Health</h1>
          <p className="text-gray-400">
            Monitor the health and performance of all integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
            {(['1h', '24h', '7d', '30d'] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={timeRange === range ? 'default' : 'ghost'}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Overall Health</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">
                  {healthData ? Math.round((healthData.summary.healthy / healthData.summary.total) * 100) : 0}%
                </p>
                <p className="text-sm text-gray-500">
                  {healthData?.summary.healthy}/{healthData?.summary.total} healthy
                </p>
              </div>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Uptime</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">
                  {healthData ? formatUptime(healthData.summary.avgUptime) : '0%'}
                </p>
                {healthData && healthData.summary.avgUptime > 99.5 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Response Time</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">
                  {healthData ? formatResponseTime(healthData.summary.avgResponseTime) : '0ms'}
                </p>
                {healthData && healthData.summary.avgResponseTime < 500 ? (
                  <ArrowDown className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Error Rate</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">
                  {healthData && healthData.summary.totalRequests > 0
                    ? ((healthData.summary.totalErrors / healthData.summary.totalRequests) * 100).toFixed(2)
                    : 0}%
                </p>
                <p className="text-sm text-gray-500">
                  {healthData?.summary.totalErrors} errors
                </p>
              </div>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Status Overview */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Status Overview
        </h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-green-950/20 rounded-lg">
            <p className="text-3xl font-bold text-green-500">
              {healthData?.summary.healthy || 0}
            </p>
            <p className="text-sm text-gray-400">Healthy</p>
          </div>
          <div className="text-center p-3 bg-yellow-950/20 rounded-lg">
            <p className="text-3xl font-bold text-yellow-500">
              {healthData?.summary.degraded || 0}
            </p>
            <p className="text-sm text-gray-400">Degraded</p>
          </div>
          <div className="text-center p-3 bg-red-950/20 rounded-lg">
            <p className="text-3xl font-bold text-red-500">
              {healthData?.summary.down || 0}
            </p>
            <p className="text-sm text-gray-400">Down</p>
          </div>
        </div>

        <Progress 
          value={healthData ? (healthData.summary.healthy / healthData.summary.total) * 100 : 0} 
          className="h-3"
        />
      </Card>

      {/* Integration Health Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-12 w-12 bg-gray-800 rounded-lg"></div>
                <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                <div className="h-3 bg-gray-800 rounded w-full"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthData?.integrations.map((integration) => {
            const Icon = getIntegrationIcon(integration.provider);
            const hasIncidents = integration.incidents.filter(i => !i.resolved).length > 0;
            
            return (
              <Card
                key={integration.provider}
                className={`p-6 hover:border-gray-700 transition-colors cursor-pointer ${
                  hasIncidents ? 'border-yellow-800' : ''
                }`}
                onClick={() => setSelectedIntegration(integration.provider)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <Icon className={`h-6 w-6 ${getStatusColor(integration.status)}`} />
                  </div>
                  <Badge variant={getStatusBadge(integration.status) as any}>
                    {integration.status}
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-lg mb-1">{integration.name}</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Uptime</span>
                    <span className="font-medium">{formatUptime(integration.uptime)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Response Time</span>
                    <span className="font-medium">{formatResponseTime(integration.responseTime)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Error Rate</span>
                    <span className="font-medium">{integration.errorRate.toFixed(2)}%</span>
                  </div>
                </div>

                {hasIncidents && (
                  <div className="p-2 bg-yellow-950/20 rounded-lg mb-3">
                    <p className="text-xs text-yellow-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {integration.incidents.filter(i => !i.resolved).length} active incident(s)
                    </p>
                  </div>
                )}

                {integration.metrics.usage !== undefined && integration.metrics.limit !== undefined && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Usage</span>
                      <span>{Math.round((integration.metrics.usage / integration.metrics.limit) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(integration.metrics.usage / integration.metrics.limit) * 100} 
                      className="h-1"
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-500">
                    Last check: {new Date(integration.lastCheck).toLocaleTimeString()}
                  </p>
                  <Button size="sm" variant="ghost">
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Selected Integration Details */}
      {selectedIntegration && healthData && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              {healthData.integrations.find(i => i.provider === selectedIntegration)?.name} Details
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIntegration(null)}
            >
              Close
            </Button>
          </div>

          {(() => {
            const integration = healthData.integrations.find(i => i.provider === selectedIntegration);
            if (!integration) return null;

            return (
              <div className="space-y-4">
                {/* Endpoints */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Endpoint Status</h4>
                  <div className="space-y-2">
                    {integration.endpoints.map((endpoint) => (
                      <div key={endpoint.url} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            endpoint.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm">{endpoint.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {formatResponseTime(endpoint.responseTime)}
                          </span>
                          <Badge variant={endpoint.status === 'up' ? 'success' : 'destructive'} className="text-xs">
                            {endpoint.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Incidents */}
                {integration.incidents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recent Incidents</h4>
                    <div className="space-y-2">
                      {integration.incidents.slice(0, 5).map((incident) => (
                        <div key={incident.id} className="p-3 bg-gray-900 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${getSeverityColor(incident.severity)}`}>
                                {incident.severity.toUpperCase()}
                              </p>
                              <p className="text-sm text-gray-300 mt-1">{incident.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(incident.timestamp).toLocaleString()}
                              </p>
                            </div>
                            {incident.resolved ? (
                              <Badge variant="success" className="text-xs">Resolved</Badge>
                            ) : (
                              <Badge variant="warning" className="text-xs">Active</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Link href={`/applications/integrations/${selectedIntegration}`}>
                    <Button size="sm" variant="outline">
                      <Settings className="h-3 w-3 mr-2" />
                      Configure
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-3 w-3 mr-2" />
                    View Dashboard
                  </Button>
                </div>
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}