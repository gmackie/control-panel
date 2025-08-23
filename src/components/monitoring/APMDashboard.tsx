"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Globe,
  Database,
  Server,
  Network,
  Eye,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  LineChart,
  PieChart,
  Target,
  Layers,
  GitBranch,
  Package,
  ExternalLink,
  Search,
  Calendar,
  Settings,
  Bell,
  Heart,
  Shield,
  Cpu,
  HardDrive
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ApplicationTrace {
  id: string;
  name: string;
  startTime: Date;
  duration: number;
  status: 'success' | 'error' | 'warning';
  spans: TraceSpan[];
  errorMessage?: string;
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
}

interface TraceSpan {
  id: string;
  operationName: string;
  service: string;
  startTime: number;
  duration: number;
  tags: Record<string, any>;
  logs?: LogEntry[];
  status: 'ok' | 'error' | 'timeout';
}

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  fields?: Record<string, any>;
}

interface ServiceMetrics {
  serviceName: string;
  averageResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  availability: number;
  apdex: number;
  dependencies: string[];
}

interface ErrorAnalysis {
  id: string;
  error: string;
  count: number;
  percentage: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedEndpoints: string[];
  stackTrace?: string;
  service: string;
}

interface APMDashboardProps {
  applications: Array<{
    id: string;
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    environment: string;
    version: string;
  }>;
}

export function APMDashboard({ applications }: APMDashboardProps) {
  const [selectedApplication, setSelectedApplication] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [viewMode, setViewMode] = useState<'traces' | 'services' | 'errors' | 'dependencies'>('traces');
  const [selectedTrace, setSelectedTrace] = useState<ApplicationTrace | null>(null);

  const generateMockTraces = (): ApplicationTrace[] => {
    const traces: ApplicationTrace[] = [];
    const now = new Date();
    const services = ['control-panel-api', 'gitea-server', 'drone-ci', 'harbor-registry', 'database'];
    const endpoints = ['/api/applications', '/api/deployments', '/api/monitoring', '/api/auth', '/api/health'];
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];

    for (let i = 0; i < 50; i++) {
      const startTime = new Date(now.getTime() - Math.random() * 3600000); // Last hour
      const duration = Math.random() * 2000 + 50; // 50ms to 2s
      const status = Math.random() > 0.1 ? 'success' : Math.random() > 0.5 ? 'error' : 'warning';
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const method = methods[Math.floor(Math.random() * methods.length)];

      const spans: TraceSpan[] = [];
      let currentTime = 0;

      // Generate spans for the trace
      for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
        const spanDuration = Math.random() * 200 + 10;
        const service = services[Math.floor(Math.random() * services.length)];
        
        spans.push({
          id: `span-${i}-${j}`,
          operationName: `${service}.${endpoint.split('/').pop()}`,
          service,
          startTime: currentTime,
          duration: spanDuration,
          tags: {
            'http.method': method,
            'http.url': endpoint,
            'component': service,
            'db.type': service === 'database' ? 'postgresql' : undefined
          },
          status: status === 'error' && j === spans.length ? 'error' : 'ok'
        });

        currentTime += spanDuration;
      }

      traces.push({
        id: `trace-${i}`,
        name: `${method} ${endpoint}`,
        startTime,
        duration,
        status,
        spans,
        errorMessage: status === 'error' ? 'Database connection timeout' : undefined,
        userId: Math.random() > 0.3 ? `user-${Math.floor(Math.random() * 1000)}` : undefined,
        endpoint,
        method,
        statusCode: status === 'error' ? 500 : status === 'warning' ? 404 : 200
      });
    }

    return traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  };

  const generateMockServiceMetrics = (): ServiceMetrics[] => {
    return applications.map(app => ({
      serviceName: app.name,
      averageResponseTime: Math.random() * 300 + 50,
      requestsPerMinute: Math.floor(Math.random() * 1000) + 100,
      errorRate: Math.random() * 5,
      p95ResponseTime: Math.random() * 600 + 200,
      p99ResponseTime: Math.random() * 1200 + 400,
      throughput: Math.floor(Math.random() * 2000) + 500,
      availability: 99.9 - Math.random() * 0.5,
      apdex: 0.95 - Math.random() * 0.2,
      dependencies: ['database', 'redis', 'api-gateway'].slice(0, Math.floor(Math.random() * 3) + 1)
    }));
  };

  const generateMockErrors = (): ErrorAnalysis[] => {
    const errors = [
      'Database connection timeout',
      'Invalid API key provided',
      'Resource not found',
      'Rate limit exceeded',
      'Internal server error',
      'Authentication failed',
      'Validation error: missing required field'
    ];

    return errors.map((error, i) => {
      const count = Math.floor(Math.random() * 100) + 1;
      const now = new Date();
      
      return {
        id: `error-${i}`,
        error,
        count,
        percentage: (count / 1000) * 100,
        firstSeen: new Date(now.getTime() - Math.random() * 86400000 * 7), // Last 7 days
        lastSeen: new Date(now.getTime() - Math.random() * 3600000), // Last hour
        affectedEndpoints: ['/api/applications', '/api/deployments'].slice(0, Math.floor(Math.random() * 2) + 1),
        service: applications[Math.floor(Math.random() * applications.length)]?.name || 'unknown',
        stackTrace: `Error: ${error}\n  at handler (/app/src/api.js:42:5)\n  at router (/app/src/index.js:15:3)`
      };
    });
  };

  const traces = generateMockTraces();
  const serviceMetrics = generateMockServiceMetrics();
  const errorAnalysis = generateMockErrors();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': case 'healthy': case 'ok': return 'text-green-400';
      case 'warning': case 'degraded': case 'timeout': return 'text-yellow-400';
      case 'error': case 'unhealthy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': case 'healthy': case 'ok': 
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': case 'degraded': case 'timeout': 
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': case 'unhealthy': 
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: 
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const TraceTimeline = ({ trace }: { trace: ApplicationTrace }) => {
    const totalDuration = trace.duration;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Trace Timeline</span>
          <span>Total: {formatDuration(totalDuration)}</span>
        </div>
        <div className="relative bg-gray-900 h-8 rounded">
          {trace.spans.map((span, index) => {
            const left = (span.startTime / totalDuration) * 100;
            const width = (span.duration / totalDuration) * 100;
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-cyan-500'];
            
            return (
              <div
                key={span.id}
                className={`absolute h-6 top-1 rounded text-xs flex items-center justify-center text-white ${colors[index % colors.length]} ${span.status === 'error' ? 'bg-red-500' : ''}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  minWidth: '2px'
                }}
                title={`${span.service}: ${span.operationName} (${formatDuration(span.duration)})`}
              >
                {width > 10 && (
                  <span className="truncate px-1">{span.service}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex text-xs text-gray-500">
          <span>0ms</span>
          <span className="ml-auto">{formatDuration(totalDuration)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Application Performance Monitoring
        </h2>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedApplication}
            onChange={(e) => setSelectedApplication(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value="all">All Applications</option>
            {applications.map(app => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
          
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="24h">24 hours</option>
          </select>
          
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* APM Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Response Time</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-400">
                {serviceMetrics.length > 0 ? Math.round(serviceMetrics.reduce((sum, s) => sum + s.averageResponseTime, 0) / serviceMetrics.length) : 0}ms
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingDown className="h-3 w-3" />
                12% faster
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Requests/min</span>
            <Zap className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-yellow-400">
                {serviceMetrics.reduce((sum, s) => sum + s.requestsPerMinute, 0).toLocaleString()}
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="h-3 w-3" />
                8% increase
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Error Rate</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-red-400">
                {serviceMetrics.length > 0 ? (serviceMetrics.reduce((sum, s) => sum + s.errorRate, 0) / serviceMetrics.length).toFixed(2) : 0}%
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingDown className="h-3 w-3" />
                0.3% better
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Apdex Score</span>
            <Target className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-green-400">
                {serviceMetrics.length > 0 ? (serviceMetrics.reduce((sum, s) => sum + s.apdex, 0) / serviceMetrics.length).toFixed(2) : 0}
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="h-3 w-3" />
                Excellent
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* View Mode Selector */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'traces' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('traces')}
          >
            <Activity className="h-4 w-4 mr-1" />
            Traces
          </Button>
          <Button
            variant={viewMode === 'services' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('services')}
          >
            <Server className="h-4 w-4 mr-1" />
            Services
          </Button>
          <Button
            variant={viewMode === 'errors' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('errors')}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Errors
          </Button>
          <Button
            variant={viewMode === 'dependencies' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('dependencies')}
          >
            <Layers className="h-4 w-4 mr-1" />
            Dependencies
          </Button>
        </div>
      </Card>

      {viewMode === 'traces' && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Traces</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filter
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {traces.slice(0, 10).map(trace => (
                <div
                  key={trace.id}
                  className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 cursor-pointer"
                  onClick={() => setSelectedTrace(selectedTrace?.id === trace.id ? null : trace)}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(trace.status)}
                    <span className={`text-sm font-mono ${getStatusColor(trace.status)}`}>
                      {trace.statusCode}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium">{trace.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {trace.method}
                      </Badge>
                      {trace.userId && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {trace.userId}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{formatDistanceToNow(trace.startTime, { addSuffix: true })}</span>
                      <span>•</span>
                      <span>{formatDuration(trace.duration)}</span>
                      <span>•</span>
                      <span>{trace.spans.length} spans</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-lg font-semibold ${getStatusColor(trace.status)}`}>
                      {formatDuration(trace.duration)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {selectedTrace && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold">Trace Details: {selectedTrace.name}</h4>
                <Button variant="outline" size="sm" onClick={() => setSelectedTrace(null)}>
                  Close
                </Button>
              </div>

              <TraceTimeline trace={selectedTrace} />

              <div className="mt-6 space-y-4">
                <h5 className="font-medium">Spans ({selectedTrace.spans.length})</h5>
                {selectedTrace.spans.map((span, index) => (
                  <div key={span.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded">
                    <div className="w-4 text-center text-sm text-gray-500">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium">{span.operationName}</span>
                        <Badge variant="outline" className="text-xs">
                          {span.service}
                        </Badge>
                        {getStatusIcon(span.status)}
                      </div>
                      <div className="text-sm text-gray-400">
                        Started: {span.startTime}ms • Duration: {formatDuration(span.duration)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedTrace.errorMessage && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
                  <h6 className="font-medium text-red-400 mb-2">Error Details</h6>
                  <p className="text-sm text-red-300">{selectedTrace.errorMessage}</p>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {viewMode === 'services' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Service Performance</h3>
          <div className="space-y-4">
            {serviceMetrics.map(service => (
              <div key={service.serviceName} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-blue-500" />
                  <div>
                    <h4 className="font-medium">{service.serviceName}</h4>
                    <p className="text-sm text-gray-400">
                      {service.dependencies.length} dependencies
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-medium">{Math.round(service.averageResponseTime)}ms</p>
                    <p className="text-gray-400">Avg Response</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{service.requestsPerMinute}/min</p>
                    <p className="text-gray-400">Requests</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-medium ${service.errorRate < 1 ? 'text-green-400' : 'text-red-400'}`}>
                      {service.errorRate.toFixed(2)}%
                    </p>
                    <p className="text-gray-400">Error Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-green-400">{service.apdex.toFixed(2)}</p>
                    <p className="text-gray-400">Apdex</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {viewMode === 'errors' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Error Analysis</h3>
            <div className="text-sm text-gray-400">
              {errorAnalysis.reduce((sum, e) => sum + e.count, 0)} total errors
            </div>
          </div>
          
          <div className="space-y-3">
            {errorAnalysis.map(error => (
              <div key={error.id} className="p-4 bg-gray-900/50 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-red-400">{error.error}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                      <span>Service: {error.service}</span>
                      <span>•</span>
                      <span>Count: {error.count}</span>
                      <span>•</span>
                      <span>Rate: {error.percentage.toFixed(2)}%</span>
                    </div>
                  </div>
                  <Badge variant="error">{error.count}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">First seen: </span>
                    <span>{formatDistanceToNow(error.firstSeen, { addSuffix: true })}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Last seen: </span>
                    <span>{formatDistanceToNow(error.lastSeen, { addSuffix: true })}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-sm text-gray-400">Affected endpoints: </span>
                  <span className="text-sm">{error.affectedEndpoints.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {viewMode === 'dependencies' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Service Dependencies</h3>
          <div className="space-y-6">
            {serviceMetrics.map(service => (
              <div key={service.serviceName} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-blue-500" />
                  <h4 className="font-medium">{service.serviceName}</h4>
                </div>
                <div className="ml-8 flex items-center gap-4">
                  {service.dependencies.map(dep => (
                    <div key={dep} className="flex items-center gap-2 p-2 bg-gray-900/50 rounded">
                      <Database className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">{dep}</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  ))}
                  {service.dependencies.length === 0 && (
                    <span className="text-sm text-gray-400">No external dependencies</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}