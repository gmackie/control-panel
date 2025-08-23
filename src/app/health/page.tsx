"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Server,
  Globe,
  Database,
  Zap,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Eye,
  Settings,
  BarChart3,
  Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ServiceHealthCard } from "@/components/health/ServiceHealthCard";
import { ServiceMetricsChart } from "@/components/health/ServiceMetricsChart";
import { IncidentManagement } from "@/components/health/IncidentManagement";
import { SLODashboard } from "@/components/health/SLODashboard";

interface ServiceHealth {
  id: string;
  name: string;
  type: 'application' | 'database' | 'external_api' | 'infrastructure';
  status: 'healthy' | 'degraded' | 'down' | 'maintenance';
  uptime: number;
  responseTime: number;
  errorRate: number;
  endpoints: HealthCheck[];
  lastChecked: Date;
  environment: 'production' | 'staging' | 'development';
  dependencies: string[];
  metrics: ServiceMetrics;
  incidents?: Incident[];
  slo?: SLO;
}

interface HealthCheck {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number;
  timeout: number;
  interval: number;
  status: 'passing' | 'failing' | 'unknown';
  lastCheck: Date;
  lastSuccess: Date;
  responseTime: number;
  consecutiveFailures: number;
}

interface ServiceMetrics {
  availability: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  alertsTriggered: number;
  lastDay: {
    requests: number;
    errors: number;
    availability: number;
  };
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  startedAt: Date;
  resolvedAt?: Date;
  impact: string;
  updates: IncidentUpdate[];
}

interface IncidentUpdate {
  id: string;
  timestamp: Date;
  status: Incident['status'];
  message: string;
  user: string;
}

interface SLO {
  target: number;
  current: number;
  period: '7d' | '30d' | '90d';
  errorBudget: {
    remaining: number;
    consumed: number;
    total: number;
  };
}

export default function HealthPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchHealthData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchHealthData = async () => {
    try {
      setIsLoading(true);
      const [servicesRes, incidentsRes] = await Promise.all([
        fetch('/api/health/services'),
        fetch('/api/health/incidents')
      ]);
      
      const servicesData = await servicesRes.json();
      const incidentsData = await incidentsRes.json();
      
      setServices(servicesData.services || []);
      setIncidents(incidentsData.incidents || []);
    } catch (error) {
      console.error('Error fetching health data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate overall system health
  const healthyServices = services.filter(s => s.status === 'healthy').length;
  const degradedServices = services.filter(s => s.status === 'degraded').length;
  const downServices = services.filter(s => s.status === 'down').length;
  const totalServices = services.length;
  
  const systemStatus = downServices > 0 ? 'down' : 
                      degradedServices > 0 ? 'degraded' : 'healthy';
  
  const overallUptime = services.length > 0 
    ? services.reduce((acc, s) => acc + s.uptime, 0) / services.length 
    : 0;

  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const criticalIncidents = activeIncidents.filter(i => i.severity === 'critical');

  const getSystemStatusIcon = () => {
    switch (systemStatus) {
      case 'healthy':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Clock className="h-8 w-8 text-gray-500" />;
    }
  };

  const getSystemStatusBadge = () => {
    switch (systemStatus) {
      case 'healthy':
        return <Badge className="bg-green-500">All Systems Operational</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">Degraded Performance</Badge>;
      case 'down':
        return <Badge className="bg-red-500">System Outage</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
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
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-gray-400 mt-1">
            Monitor service health, incidents, and SLA performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Auto-refresh</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-500/20 text-green-400' : ''}
            >
              {autoRefresh ? 'On' : 'Off'}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealthData}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {getSystemStatusIcon()}
            <div>
              <h2 className="text-xl font-semibold">System Status</h2>
              <p className="text-gray-400">
                Last updated {formatDistanceToNow(new Date(), { addSuffix: true })}
              </p>
            </div>
          </div>
          {getSystemStatusBadge()}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{healthyServices}</p>
            <p className="text-sm text-gray-400">Healthy Services</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold">{degradedServices}</p>
            <p className="text-sm text-gray-400">Degraded Services</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <XCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-2xl font-bold">{downServices}</p>
            <p className="text-sm text-gray-400">Down Services</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{overallUptime.toFixed(2)}%</p>
            <p className="text-sm text-gray-400">Overall Uptime</p>
          </div>
        </div>

        {/* Critical Alerts */}
        {criticalIncidents.length > 0 && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-400">
                Critical Incidents ({criticalIncidents.length})
              </span>
            </div>
            <div className="space-y-2">
              {criticalIncidents.map(incident => (
                <div key={incident.id} className="flex items-center justify-between">
                  <span className="text-sm">{incident.title}</span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(incident.startedAt, { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="slo">SLOs</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          {/* Environment Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Environment:</span>
            {['all', 'production', 'staging', 'development'].map(env => (
              <Button
                key={env}
                variant="outline"
                size="sm"
                className="capitalize"
              >
                {env}
              </Button>
            ))}
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {services.map(service => (
              <ServiceHealthCard
                key={service.id}
                service={service}
                onViewDetails={(serviceId) => {
                  // Navigate to service details
                  console.log('View details for service:', serviceId);
                }}
                onRunCheck={(serviceId) => {
                  // Trigger manual health check
                  console.log('Run check for service:', serviceId);
                }}
              />
            ))}
          </div>

          {services.length === 0 && (
            <div className="text-center py-16">
              <Activity className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No Services Configured</h3>
              <p className="text-gray-500 mb-4">Add your first service to start monitoring</p>
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Configure Services
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Time Range:</span>
            {(['1h', '24h', '7d', '30d'] as const).map(range => (
              <Button
                key={range}
                variant={selectedTimeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>

          {/* Metrics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {services.slice(0, 4).map(service => (
              <ServiceMetricsChart
                key={service.id}
                service={service}
                timeRange={selectedTimeRange}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <IncidentManagement 
            incidents={incidents}
            services={services}
            onCreateIncident={(incident) => {
              // Handle incident creation
              console.log('Creating incident:', incident);
            }}
            onUpdateIncident={(incidentId, update) => {
              // Handle incident update
              console.log('Updating incident:', incidentId, update);
            }}
          />
        </TabsContent>

        <TabsContent value="slo" className="space-y-4">
          <SLODashboard 
            services={services.filter(s => s.slo) as any}
            onUpdateSLO={(serviceId, slo) => {
              // Handle SLO update
              console.log('Updating SLO:', serviceId, slo);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}