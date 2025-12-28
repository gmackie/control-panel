"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  Database,
  Settings,
  ExternalLink,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  CreditCard,
  Database as DatabaseIcon,
  Monitor,
  GitBranch,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  AppService,
  Integration,
  Database as ServiceDatabase,
  Monitoring,
} from "@/types";

export default function ServiceDetailPage() {
  const params = useParams();
  const serviceId = params.id as string;
  const [activeTab, setActiveTab] = useState("overview");

  const { data: service, isLoading } = useQuery({
    queryKey: ["service", serviceId],
    queryFn: async () => {
      const response = await fetch(`/api/services/${serviceId}`);
      return response.json();
    },
  });

  const { data: integrations } = useQuery({
    queryKey: ["service-integrations", serviceId],
    queryFn: async () => {
      const response = await fetch(`/api/services/${serviceId}/integrations`);
      return response.json();
    },
  });

  const { data: databases } = useQuery({
    queryKey: ["service-databases", serviceId],
    queryFn: async () => {
      const response = await fetch(`/api/services/${serviceId}/databases`);
      return response.json();
    },
  });

  const { data: monitoring } = useQuery({
    queryKey: ["service-monitoring", serviceId],
    queryFn: async () => {
      const response = await fetch(`/api/services/${serviceId}/monitoring`);
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Service not found</h2>
        <p className="text-muted-foreground">
          The service you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      case "error":
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const tabs = [
    { id: "overview", name: "Overview", icon: Activity },
    { id: "integrations", name: "Integrations", icon: Zap },
    { id: "databases", name: "Databases", icon: DatabaseIcon },
    { id: "monitoring", name: "Monitoring", icon: Monitor },
    { id: "deployments", name: "Deployments", icon: GitBranch },
    { id: "security", name: "Security", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{service.name}</h1>
          <p className="text-muted-foreground">
            {service.type} • {service.environment}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(service.status)}
            <div>
              <h3 className="font-semibold">Service Status</h3>
              <p className={`text-sm ${getStatusColor(service.status)}`}>
                {service.status.charAt(0).toUpperCase() +
                  service.status.slice(1)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Uptime</p>
            <p className="font-semibold">{service.uptime}</p>
          </div>
        </div>

        {service.url && (
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {service.url}
            </a>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Metrics */}
            {service.metrics && (
              <>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      CPU Usage
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{service.metrics.cpu}%</p>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Memory Usage
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {service.metrics.memory}%
                  </p>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Requests
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {service.metrics.requests?.toLocaleString()}
                  </p>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Response Time
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {service.metrics.responseTime}ms
                  </p>
                </div>
              </>
            )}

            {/* Integrations Summary */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Integrations
                </span>
              </div>
              <p className="text-2xl font-bold">{integrations?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>

            {/* Databases Summary */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DatabaseIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Databases</span>
              </div>
              <p className="text-2xl font-bold">{databases?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Integrations</h3>
              <button className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                <Plus className="w-4 h-4" />
                Add Integration
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations?.map((integration: Integration) => (
                <div
                  key={integration.id}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          integration.status === "active"
                            ? "bg-green-500"
                            : integration.status === "inactive"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {integration.name}
                      </span>
                    </div>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {integration.provider}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {integration.type}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Last checked:{" "}
                      {new Date(integration.lastChecked).toLocaleDateString()}
                    </span>
                    <span>{integration.apiKeys.length} keys</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "databases" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Databases</h3>
              <button className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                <Plus className="w-4 h-4" />
                Add Database
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {databases?.map((database: ServiceDatabase) => (
                <div
                  key={database.id}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          database.status === "healthy"
                            ? "bg-green-500"
                            : database.status === "warning"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {database.name}
                      </span>
                    </div>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {database.type}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {database.provider}
                  </p>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span>{(database.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connections:</span>
                      <span>{database.connections}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Operations:</span>
                      <span>
                        {database.operations.reads + database.operations.writes}
                        /s
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "monitoring" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Monitoring</h3>
              <button className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                <Plus className="w-4 h-4" />
                Add Alert
              </button>
            </div>

            {monitoring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Prometheus */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Monitor className="w-4 h-4" />
                    <h4 className="font-medium">Prometheus</h4>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        monitoring.prometheus.enabled
                          ? "bg-green-500"
                          : "bg-gray-500"
                      }`}
                    />
                  </div>
                  {monitoring.prometheus.enabled ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        URL: {monitoring.prometheus.url}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Metrics: {monitoring.prometheus.metrics.length}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Alerts: {monitoring.prometheus.alerts.length}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not configured
                    </p>
                  )}
                </div>

                {/* Grafana */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4" />
                    <h4 className="font-medium">Grafana</h4>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        monitoring.grafana.enabled
                          ? "bg-green-500"
                          : "bg-gray-500"
                      }`}
                    />
                  </div>
                  {monitoring.grafana.enabled ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        URL: {monitoring.grafana.url}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Dashboards: {monitoring.grafana.dashboards.length}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not configured
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "deployments" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Deployments</h3>
            <p className="text-muted-foreground">
              Deployment history and configuration will be shown here.
            </p>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Security</h3>
            <p className="text-muted-foreground">
              Security settings and API key management will be shown here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
