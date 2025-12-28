'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  GitBranch, 
  Package, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  ExternalLink,
  Eye,
  BarChart3,
  FileText,
  Zap,
  Layers,
  Monitor
} from 'lucide-react';
import { ApplicationMonitoring } from '@/lib/monitoring/application-monitor';

interface UnifiedApplicationDashboardProps {
  applications: ApplicationMonitoring[];
  onRefresh?: () => void;
}

export function UnifiedApplicationDashboard({ 
  applications, 
  onRefresh 
}: UnifiedApplicationDashboardProps) {
  const [selectedApp, setSelectedApp] = useState<ApplicationMonitoring | null>(
    applications[0] || null
  );
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'deployed': return 'bg-green-500';
      case 'success': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'pending': return 'bg-blue-500';
      case 'running': return 'bg-blue-500';
      case 'critical': return 'bg-red-500';
      case 'failed': return 'bg-red-500';
      case 'failure': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'deployed':
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
      case 'pending':
      case 'running':
        return <Clock className="h-4 w-4" />;
      case 'critical':
      case 'failed':
      case 'failure':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Application Monitoring</h1>
          <p className="text-muted-foreground">
            Comprehensive monitoring for Git repos, Helm charts, pods, and observability
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <Activity className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Applications Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {applications.map((app) => (
          <Card 
            key={app.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedApp?.id === app.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedApp(app)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{app.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {app.k8s.cluster}
                </Badge>
              </div>
              <CardDescription>{app.namespace}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Health Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Health</span>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(app.health.status)}
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(app.health.status)} text-white text-xs`}
                    >
                      {app.health.status}
                    </Badge>
                  </div>
                </div>

                {/* Pods */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pods</span>
                  <span className="text-sm font-medium">
                    {app.pods.ready}/{app.pods.desired}
                  </span>
                </div>

                {/* Helm Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Helm</span>
                  <Badge 
                    variant="outline" 
                    className={`${getStatusColor(app.helm.status)} text-white text-xs`}
                  >
                    {app.helm.status}
                  </Badge>
                </div>

                {/* Last Commit */}
                {app.git.lastCommit && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Last commit: {app.git.lastCommit.message.substring(0, 40)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by {app.git.lastCommit.author}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Application View */}
      {selectedApp && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{selectedApp.name}</CardTitle>
                <CardDescription>
                  {selectedApp.namespace} • {selectedApp.k8s.cluster} cluster
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className={`${getStatusColor(selectedApp.health.status)} text-white`}
                >
                  {getStatusIcon(selectedApp.health.status)}
                  <span className="ml-1">{selectedApp.health.status}</span>
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="git">Git</TabsTrigger>
                <TabsTrigger value="helm">Helm</TabsTrigger>
                <TabsTrigger value="pods">Pods</TabsTrigger>
                <TabsTrigger value="observability">Observability</TabsTrigger>
                <TabsTrigger value="cicd">CI/CD</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Running Pods</CardTitle>
                      <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {selectedApp.pods.running}/{selectedApp.pods.desired}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedApp.pods.ready} ready
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Helm Status</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedApp.helm.status}</div>
                      <p className="text-xs text-muted-foreground">
                        {selectedApp.helm.chartVersion}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {selectedApp.health.responseTime ? `${selectedApp.health.responseTime}ms` : 'N/A'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last check: {new Date(selectedApp.health.lastCheck).toLocaleTimeString()}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Restarts</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedApp.pods.restarts}</div>
                      <p className="text-xs text-muted-foreground">
                        Total pod restarts
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Git Tab */}
              <TabsContent value="git" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      Git Repository
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Repository URL:</span>
                      <a 
                        href={selectedApp.git.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-9 rounded-md px-3 text-sm font-medium transition-colors border border-gray-700 bg-transparent hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        View Repository
                      </a>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span>Branch:</span>
                      <Badge variant="outline">{selectedApp.git.branch}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Provider:</span>
                      <Badge variant="secondary">{selectedApp.git.provider}</Badge>
                    </div>

                    {selectedApp.git.lastCommit && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-2">Latest Commit</h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">SHA:</span>
                            <code className="ml-2 text-sm bg-muted px-1 py-0.5 rounded">
                              {selectedApp.git.lastCommit.sha.substring(0, 8)}
                            </code>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Message:</span>
                            <p className="text-sm">{selectedApp.git.lastCommit.message}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Author:</span>
                            <span className="ml-2 text-sm">{selectedApp.git.lastCommit.author}</span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Time:</span>
                            <span className="ml-2 text-sm">
                              {new Date(selectedApp.git.lastCommit.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Helm Tab */}
              <TabsContent value="helm" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Helm Chart
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Chart Name:</span>
                        <p className="font-medium">{selectedApp.helm.chartName}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Chart Version:</span>
                        <p className="font-medium">{selectedApp.helm.chartVersion}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Release Name:</span>
                        <p className="font-medium">{selectedApp.helm.releaseName}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge className={`${getStatusColor(selectedApp.helm.status)} text-white`}>
                          {selectedApp.helm.status}
                        </Badge>
                      </div>
                      {selectedApp.helm.deployedVersion && (
                        <div>
                          <span className="text-sm text-muted-foreground">App Version:</span>
                          <p className="font-medium">{selectedApp.helm.deployedVersion}</p>
                        </div>
                      )}
                      {selectedApp.helm.lastDeployed && (
                        <div>
                          <span className="text-sm text-muted-foreground">Last Deployed:</span>
                          <p className="font-medium">
                            {new Date(selectedApp.helm.lastDeployed).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span>Chart Repository:</span>
                      <a 
                        href={selectedApp.helm.repository} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-9 rounded-md px-3 text-sm font-medium transition-colors border border-gray-700 bg-transparent hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        View Charts
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Pods Tab */}
              <TabsContent value="pods" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Desired</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedApp.pods.desired}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Ready</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{selectedApp.pods.ready}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Running</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">{selectedApp.pods.running}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-600">{selectedApp.pods.pending}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{selectedApp.pods.failed}</div>
                    </CardContent>
                  </Card>
                </div>

                {selectedApp.pods.restarts > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Restart Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm text-muted-foreground">Total Restarts:</span>
                          <span className="ml-2 font-medium">{selectedApp.pods.restarts}</span>
                        </div>
                        {selectedApp.pods.lastRestart && (
                          <div>
                            <span className="text-sm text-muted-foreground">Last Restart:</span>
                            <span className="ml-2 font-medium">
                              {new Date(selectedApp.pods.lastRestart).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Observability Tab */}
              <TabsContent value="observability" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Grafana */}
                  {selectedApp.observability.grafana && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Grafana
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedApp.observability.grafana.dashboardUrl && (
                          <a 
                            href={selectedApp.observability.grafana.dashboardUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-9 rounded-md px-3 text-sm font-medium transition-colors border border-gray-700 bg-transparent hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 w-full"
                          >
                            <Monitor className="mr-1 h-3 w-3" />
                            View Dashboard
                          </a>
                        )}
                        {selectedApp.observability.grafana.alertsUrl && (
                          <a 
                            href={selectedApp.observability.grafana.alertsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-9 rounded-md px-3 text-sm font-medium transition-colors border border-gray-700 bg-transparent hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 w-full"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            View Alerts
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Loki */}
                  {selectedApp.observability.loki && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Loki Logs
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedApp.observability.loki.logsUrl && (
                          <a 
                            href={selectedApp.observability.loki.logsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-9 rounded-md px-3 text-sm font-medium transition-colors border border-gray-700 bg-transparent hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 w-full"
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            View Logs
                          </a>
                        )}
                        {selectedApp.observability.loki.query && (
                          <div>
                            <span className="text-sm text-muted-foreground">Query:</span>
                            <code className="block text-xs bg-muted p-2 rounded mt-1">
                              {selectedApp.observability.loki.query}
                            </code>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Prometheus */}
                  {selectedApp.observability.prometheus && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Prometheus
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedApp.observability.prometheus.metricsUrl && (
                          <a 
                            href={selectedApp.observability.prometheus.metricsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-9 rounded-md px-3 text-sm font-medium transition-colors border border-gray-700 bg-transparent hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 w-full"
                          >
                            <BarChart3 className="mr-1 h-3 w-3" />
                            View Metrics
                          </a>
                        )}
                        {selectedApp.observability.prometheus.targets && (
                          <div>
                            <span className="text-sm text-muted-foreground">Targets:</span>
                            <div className="space-y-1 mt-1">
                              {selectedApp.observability.prometheus.targets.map((target, i) => (
                                <code key={i} className="block text-xs bg-muted p-1 rounded">
                                  {target}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* CI/CD Tab */}
              <TabsContent value="cicd" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      CI/CD Pipeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Provider:</span>
                      <Badge variant="secondary" className="ml-2">{selectedApp.cicd.provider}</Badge>
                    </div>

                    {selectedApp.cicd.lastBuild && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-2">Latest Build</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            <Badge className={`${getStatusColor(selectedApp.cicd.lastBuild.status)} text-white`}>
                              {getStatusIcon(selectedApp.cicd.lastBuild.status)}
                              <span className="ml-1">{selectedApp.cicd.lastBuild.status}</span>
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Build ID:</span>
                            <code className="text-sm bg-muted px-1 py-0.5 rounded">
                              {selectedApp.cicd.lastBuild.id}
                            </code>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Start Time:</span>
                            <span className="text-sm">
                              {new Date(selectedApp.cicd.lastBuild.startTime).toLocaleString()}
                            </span>
                          </div>
                          {selectedApp.cicd.lastBuild.duration && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Duration:</span>
                              <span className="text-sm">
                                {Math.round(selectedApp.cicd.lastBuild.duration / 1000)}s
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}