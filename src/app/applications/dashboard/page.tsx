"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  GitBranch,
  GitCommit,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Activity,
  DollarSign,
  Server,
  Play,
  Pause,
  MoreVertical,
  Code,
  Database,
  CreditCard,
  Users,
  Mic,
  Brain,
  Mail,
  MessageSquare,
  Cloud,
  Shield,
  Layers,
  ArrowUp,
  ArrowDown,
  Minus,
  Settings,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface ApplicationDashboard {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "healthy" | "degraded" | "critical" | "unknown";
  
  // Repository & CI/CD
  repository: {
    provider: "gitea" | "github" | "gitlab";
    url: string;
    defaultBranch: string;
    lastCommit: {
      sha: string;
      message: string;
      author: string;
      date: string;
    };
  };
  
  cicd: {
    provider: "gitea-actions" | "github-actions" | "gitlab-ci";
    status: "success" | "failed" | "running" | "pending";
    workflowRuns: Array<{
      id: string;
      name: string;
      status: "success" | "failed" | "running" | "pending";
      branch: string;
      commit: string;
      startedAt: string;
      completedAt?: string;
    }>;
  };
  
  // Container Registry
  registry: {
    provider: "harbor" | "dockerhub" | "gcr";
    images: Array<{
      name: string;
      tag: string;
      size: number;
      pushed: string;
      vulnerabilities?: {
        critical: number;
        high: number;
        medium: number;
        low: number;
      };
    }>;
  };
  
  // Environments
  environments: {
    staging: {
      status: "healthy" | "unhealthy" | "deploying";
      url?: string;
      version: string;
      lastDeployed: string;
      healthChecks: {
        api: boolean;
        database: boolean;
        cache: boolean;
      };
    };
    production: {
      status: "healthy" | "unhealthy" | "deploying";
      url?: string;
      version: string;
      lastDeployed: string;
      metrics: {
        requestsPerSecond: number;
        errorRate: number;
        responseTime: number;
        uptime: number;
      };
      alerts: Array<{
        id: string;
        severity: "critical" | "warning" | "info";
        message: string;
        triggeredAt: string;
      }>;
    };
  };
  
  // Integrations
  integrations: {
    stripe?: {
      connected: boolean;
      monthlyRevenue: number;
      activeSubscriptions: number;
      churnRate: number;
      lastSync: string;
    };
    clerk?: {
      connected: boolean;
      totalUsers: number;
      activeUsers: number;
      mfaAdoption: number;
      lastSync: string;
    };
    turso?: {
      connected: boolean;
      databases: number;
      storageUsed: number;
      requestsToday: number;
      lastSync: string;
    };
    supabase?: {
      connected: boolean;
      databases: number;
      realtimeConnections: number;
      storageUsed: number;
      lastSync: string;
    };
    elevenlabs?: {
      connected: boolean;
      charactersUsed: number;
      charactersLimit: number;
      voicesCreated: number;
      lastSync: string;
    };
    openrouter?: {
      connected: boolean;
      tokensUsed: number;
      costToday: number;
      modelsUsed: string[];
      lastSync: string;
    };
    sendgrid?: {
      connected: boolean;
      emailsSent: number;
      bounceRate: number;
      openRate: number;
      lastSync: string;
    };
    twilio?: {
      connected: boolean;
      messagesSent: number;
      callsToday: number;
      costToday: number;
      lastSync: string;
    };
    aws?: {
      connected: boolean;
      services: string[];
      monthlyCost: number;
      lastSync: string;
    };
  };
  
  // Cost tracking
  cost: {
    total: number;
    breakdown: {
      infrastructure: number;
      integrations: number;
      storage: number;
      bandwidth: number;
    };
    trend: "up" | "down" | "stable";
  };
}

export default function ApplicationDashboardPage() {
  const [selectedApp, setSelectedApp] = useState<string>();
  const [activeIntegrationTab, setActiveIntegrationTab] = useState<string>("stripe");
  
  // Fetch real data from API
  const { data: applications, isLoading, refetch } = useQuery<ApplicationDashboard[]>({
    queryKey: ["application-dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/applications/dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const app = selectedApp 
    ? applications?.find(a => a.id === selectedApp)
    : applications?.[0];
  
  useEffect(() => {
    if (applications && applications.length > 0 && !selectedApp) {
      setSelectedApp(applications[0].id);
    }
  }, [applications, selectedApp]);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "success":
        return "text-green-500";
      case "degraded":
      case "warning":
        return "text-yellow-500";
      case "critical":
      case "failed":
        return "text-red-500";
      case "running":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
      case "success":
        return "success";
      case "degraded":
      case "warning":
        return "warning";
      case "critical":
      case "failed":
        return "error";
      default:
        return "secondary";
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (!applications || applications.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Card className="p-12 text-center">
          <Code className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No applications found</h3>
          <p className="text-gray-400">Create your first application to see it here</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Application Dashboard</h1>
          <p className="text-gray-400">
            Complete lifecycle monitoring for all your applications
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Application Selector */}
      <div className="flex gap-2 flex-wrap">
        {applications.map((a) => (
          <Button
            key={a.id}
            variant={selectedApp === a.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedApp(a.id)}
            className="gap-2"
          >
            <div className={`h-2 w-2 rounded-full ${
              a.status === "healthy" ? "bg-green-500" :
              a.status === "degraded" ? "bg-yellow-500" :
              a.status === "critical" ? "bg-red-500" :
              "bg-gray-500"
            }`} />
            {a.name}
          </Button>
        ))}
      </div>
      
      {app && (
        <>
          {/* Application Overview */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  {app.name}
                  <Badge variant={getStatusBadge(app.status) as any}>
                    {app.status}
                  </Badge>
                </h2>
                <p className="text-gray-400 mt-1">{app.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold">
                  ${app.cost.total.toLocaleString()}
                </p>
                <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                  Monthly Cost
                  {app.cost.trend === "up" && <ArrowUp className="h-3 w-3 text-red-500" />}
                  {app.cost.trend === "down" && <ArrowDown className="h-3 w-3 text-green-500" />}
                  {app.cost.trend === "stable" && <Minus className="h-3 w-3 text-gray-500" />}
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">
                  {app.environments.production.metrics.uptime.toFixed(2)}%
                </p>
                <p className="text-sm text-gray-400">Uptime</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">
                  {app.environments.production.metrics.requestsPerSecond}
                </p>
                <p className="text-sm text-gray-400">Requests/sec</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">
                  {app.environments.production.metrics.responseTime}ms
                </p>
                <p className="text-sm text-gray-400">Response Time</p>
              </div>
            </div>
          </Card>
          
          {/* Main Content Tabs */}
          <Tabs defaultValue="lifecycle" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
              <TabsTrigger value="environments">Environments</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            </TabsList>
            
            {/* Lifecycle Tab */}
            <TabsContent value="lifecycle" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Repository Card */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Repository
                  </h3>
                  <div className="space-y-2">
                    <a
                      href={app.repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm flex items-center gap-1"
                    >
                      {app.repository.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <div className="p-3 bg-gray-900 rounded">
                      <div className="flex items-start gap-2">
                        <GitCommit className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono truncate">
                            {app.repository.lastCommit.sha}
                          </p>
                          <p className="text-sm text-gray-300 mt-1 truncate">
                            {app.repository.lastCommit.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {app.repository.lastCommit.author} •{" "}
                            {formatDistanceToNow(new Date(app.repository.lastCommit.date))} ago
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                
                {/* CI/CD Card */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    CI/CD Pipeline
                    <Badge variant={getStatusBadge(app.cicd.status) as any} className="ml-auto">
                      {app.cicd.status}
                    </Badge>
                  </h3>
                  <div className="space-y-2">
                    {app.cicd.workflowRuns.slice(0, 2).map((run) => (
                      <div key={run.id} className="p-2 bg-gray-900 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{run.name}</span>
                          {run.status === "running" ? (
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                              <span className="text-xs text-blue-500">Running</span>
                            </div>
                          ) : (
                            <Badge variant={getStatusBadge(run.status) as any} className="text-xs">
                              {run.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>{run.branch}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(run.startedAt))} ago</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    View All Workflows
                  </Button>
                </Card>
                
                {/* Registry Card */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Container Registry
                  </h3>
                  <div className="space-y-2">
                    {app.registry.images.slice(0, 2).map((image, idx) => (
                      <div key={idx} className="p-2 bg-gray-900 rounded">
                        <div className="flex items-center justify-between">
                          <code className="text-xs truncate">{image.name}:{image.tag}</code>
                          <span className="text-xs text-gray-500">
                            {(image.size / 1024 / 1024).toFixed(0)}MB
                          </span>
                        </div>
                        {image.vulnerabilities && (
                          <div className="flex gap-2 mt-2">
                            {image.vulnerabilities.critical > 0 && (
                              <span className="text-xs text-red-500">
                                {image.vulnerabilities.critical} critical
                              </span>
                            )}
                            {image.vulnerabilities.high > 0 && (
                              <span className="text-xs text-orange-500">
                                {image.vulnerabilities.high} high
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    View All Images
                  </Button>
                </Card>
              </div>
            </TabsContent>
            
            {/* Environments Tab */}
            <TabsContent value="environments" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Staging Environment */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Staging Environment
                    </h3>
                    <Badge variant={getStatusBadge(app.environments.staging.status) as any}>
                      {app.environments.staging.status}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Version:</span>
                      <span className="font-mono">{app.environments.staging.version}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last Deployed:</span>
                      <span>{formatDistanceToNow(new Date(app.environments.staging.lastDeployed))} ago</span>
                    </div>
                    {app.environments.staging.url && (
                      <a
                        href={app.environments.staging.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-sm flex items-center gap-1"
                      >
                        {app.environments.staging.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <div className="pt-2 border-t border-gray-800">
                      <p className="text-sm font-medium mb-2">Health Checks</p>
                      <div className="space-y-1">
                        {Object.entries(app.environments.staging.healthChecks).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 capitalize">{key}:</span>
                            {value ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      <Play className="h-3 w-3 mr-2" />
                      Deploy to Staging
                    </Button>
                  </div>
                </Card>
                
                {/* Production Environment */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Production Environment
                    </h3>
                    <Badge variant={getStatusBadge(app.environments.production.status) as any}>
                      {app.environments.production.status}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Version:</span>
                      <span className="font-mono">{app.environments.production.version}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last Deployed:</span>
                      <span>{formatDistanceToNow(new Date(app.environments.production.lastDeployed))} ago</span>
                    </div>
                    {app.environments.production.url && (
                      <a
                        href={app.environments.production.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-sm flex items-center gap-1"
                      >
                        {app.environments.production.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <div className="pt-2 border-t border-gray-800">
                      <p className="text-sm font-medium mb-2">Metrics</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-400">Requests/s</p>
                          <p className="font-bold">{app.environments.production.metrics.requestsPerSecond}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Error Rate</p>
                          <p className="font-bold">{app.environments.production.metrics.errorRate.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Response</p>
                          <p className="font-bold">{app.environments.production.metrics.responseTime}ms</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Uptime</p>
                          <p className="font-bold">{app.environments.production.metrics.uptime.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>
                    {app.environments.production.alerts.length > 0 && (
                      <div className="pt-2 border-t border-gray-800">
                        <p className="text-sm font-medium mb-2 text-yellow-500">Active Alerts</p>
                        {app.environments.production.alerts.map((alert) => (
                          <div key={alert.id} className="text-sm text-gray-300">
                            {alert.message}
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full">
                      <Play className="h-3 w-3 mr-2" />
                      Deploy to Production
                    </Button>
                  </div>
                </Card>
              </div>
            </TabsContent>
            
            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-4">
              <Card className="p-4">
                <Tabs value={activeIntegrationTab} onValueChange={setActiveIntegrationTab}>
                  <TabsList className="grid grid-cols-5 lg:grid-cols-9 mb-4">
                    {app.integrations.stripe && (
                      <TabsTrigger value="stripe" className="text-xs">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Stripe
                      </TabsTrigger>
                    )}
                    {app.integrations.clerk && (
                      <TabsTrigger value="clerk" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        Clerk
                      </TabsTrigger>
                    )}
                    {app.integrations.turso && (
                      <TabsTrigger value="turso" className="text-xs">
                        <Database className="h-3 w-3 mr-1" />
                        Turso
                      </TabsTrigger>
                    )}
                    {app.integrations.supabase && (
                      <TabsTrigger value="supabase" className="text-xs">
                        <Database className="h-3 w-3 mr-1" />
                        Supabase
                      </TabsTrigger>
                    )}
                    {app.integrations.elevenlabs && (
                      <TabsTrigger value="elevenlabs" className="text-xs">
                        <Mic className="h-3 w-3 mr-1" />
                        ElevenLabs
                      </TabsTrigger>
                    )}
                    {app.integrations.openrouter && (
                      <TabsTrigger value="openrouter" className="text-xs">
                        <Brain className="h-3 w-3 mr-1" />
                        OpenRouter
                      </TabsTrigger>
                    )}
                    {app.integrations.sendgrid && (
                      <TabsTrigger value="sendgrid" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        SendGrid
                      </TabsTrigger>
                    )}
                    {app.integrations.twilio && (
                      <TabsTrigger value="twilio" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Twilio
                      </TabsTrigger>
                    )}
                    {app.integrations.aws && (
                      <TabsTrigger value="aws" className="text-xs">
                        <Cloud className="h-3 w-3 mr-1" />
                        AWS
                      </TabsTrigger>
                    )}
                  </TabsList>
                  
                  {/* Stripe Integration */}
                  {app.integrations.stripe && (
                    <TabsContent value="stripe" className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Monthly Revenue</p>
                          <p className="text-2xl font-bold">
                            ${app.integrations.stripe.monthlyRevenue.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Active Subscriptions</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.stripe.activeSubscriptions}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Churn Rate</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.stripe.churnRate.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Last Sync</p>
                          <p className="text-sm">
                            {formatDistanceToNow(new Date(app.integrations.stripe.lastSync))} ago
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Stripe Dashboard
                      </Button>
                    </TabsContent>
                  )}
                  
                  {/* Clerk Integration */}
                  {app.integrations.clerk && (
                    <TabsContent value="clerk" className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Total Users</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.clerk.totalUsers.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Active Users</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.clerk.activeUsers.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">MFA Adoption</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.clerk.mfaAdoption.toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Last Sync</p>
                          <p className="text-sm">
                            {formatDistanceToNow(new Date(app.integrations.clerk.lastSync))} ago
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Clerk Dashboard
                      </Button>
                    </TabsContent>
                  )}
                  
                  {/* Turso Integration */}
                  {app.integrations.turso && (
                    <TabsContent value="turso" className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Databases</p>
                          <p className="text-2xl font-bold">{app.integrations.turso.databases}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Storage Used</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.turso.storageUsed.toFixed(1)} GB
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Requests Today</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.turso.requestsToday.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Last Sync</p>
                          <p className="text-sm">
                            {formatDistanceToNow(new Date(app.integrations.turso.lastSync))} ago
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Turso Dashboard
                      </Button>
                    </TabsContent>
                  )}
                  
                  {/* ElevenLabs Integration */}
                  {app.integrations.elevenlabs && (
                    <TabsContent value="elevenlabs" className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Characters Used</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.elevenlabs.charactersUsed.toLocaleString()}
                          </p>
                          <Progress 
                            value={(app.integrations.elevenlabs.charactersUsed / app.integrations.elevenlabs.charactersLimit) * 100}
                            className="mt-2 h-1"
                          />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Character Limit</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.elevenlabs.charactersLimit.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Voices Created</p>
                          <p className="text-2xl font-bold">
                            {app.integrations.elevenlabs.voicesCreated}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Last Sync</p>
                          <p className="text-sm">
                            {formatDistanceToNow(new Date(app.integrations.elevenlabs.lastSync))} ago
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View ElevenLabs Dashboard
                      </Button>
                    </TabsContent>
                  )}
                  
                  {/* OpenRouter Integration */}
                  {app.integrations.openrouter && (
                    <TabsContent value="openrouter" className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Tokens Used</p>
                          <p className="text-2xl font-bold">
                            {(app.integrations.openrouter.tokensUsed / 1000).toFixed(0)}k
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Cost Today</p>
                          <p className="text-2xl font-bold">
                            ${app.integrations.openrouter.costToday.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Models Used</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {app.integrations.openrouter.modelsUsed.map((model) => (
                              <Badge key={model} variant="secondary" className="text-xs">
                                {model}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Last Sync</p>
                          <p className="text-sm">
                            {formatDistanceToNow(new Date(app.integrations.openrouter.lastSync))} ago
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View OpenRouter Dashboard
                      </Button>
                    </TabsContent>
                  )}
                </Tabs>
              </Card>
            </TabsContent>
            
            {/* Monitoring Tab */}
            <TabsContent value="monitoring" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Alerts */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Active Alerts
                  </h3>
                  {app.environments.production.alerts.length > 0 ? (
                    <div className="space-y-2">
                      {app.environments.production.alerts.map((alert) => (
                        <div key={alert.id} className="p-2 bg-gray-900 rounded flex items-start gap-2">
                          <AlertCircle className={`h-4 w-4 mt-0.5 ${
                            alert.severity === "critical" ? "text-red-500" :
                            alert.severity === "warning" ? "text-yellow-500" :
                            "text-blue-500"
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm">{alert.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(alert.triggeredAt))} ago
                            </p>
                          </div>
                          <Badge variant={
                            alert.severity === "critical" ? "error" :
                            alert.severity === "warning" ? "warning" :
                            "default"
                          } className="text-xs">
                            {alert.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No active alerts</p>
                  )}
                </Card>
                
                {/* Cost Breakdown */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Cost Breakdown
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">Infrastructure</span>
                        <span className="text-sm font-medium">
                          ${app.cost.breakdown.infrastructure}
                        </span>
                      </div>
                      <Progress 
                        value={(app.cost.breakdown.infrastructure / app.cost.total) * 100}
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">Integrations</span>
                        <span className="text-sm font-medium">
                          ${app.cost.breakdown.integrations}
                        </span>
                      </div>
                      <Progress 
                        value={(app.cost.breakdown.integrations / app.cost.total) * 100}
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">Storage</span>
                        <span className="text-sm font-medium">
                          ${app.cost.breakdown.storage}
                        </span>
                      </div>
                      <Progress 
                        value={(app.cost.breakdown.storage / app.cost.total) * 100}
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">Bandwidth</span>
                        <span className="text-sm font-medium">
                          ${app.cost.breakdown.bandwidth}
                        </span>
                      </div>
                      <Progress 
                        value={(app.cost.breakdown.bandwidth / app.cost.total) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}