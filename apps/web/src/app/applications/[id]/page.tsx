"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity,
  Code,
  GitCommit,
  GitBranch,
  PlayCircle,
  Rocket,
  AlertTriangle,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Key,
  Package,
  ArrowLeft,
  CheckSquare,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

// Import new unified tab components
import {
  CommitsTab,
  PipelinesTab,
  DeploymentsTab,
  ErrorsTab,
  UsersTab,
  AnalyticsTab,
  PaymentsTab,
  ActivityTab,
  MetricsTab,
  LogsTab,
  AlertsTab,
} from "@/components/applications/tabs";

// Import existing components for secrets/integrations/settings
import { SecretsList } from "@/components/applications/SecretsList";
import { IntegrationsList } from "@/components/applications/IntegrationsList";
import { ApplicationSettings } from "@/components/applications/ApplicationSettings";
import { ProviderBadges } from "@/components/applications/ProviderBadges";
import { DeploymentTrigger } from "@/components/applications/DeploymentTrigger";
import { TaskBoard } from "@/components/tasks";
import { ReleaseList } from "@/components/releases";
import { EditableText } from "@/components/ui/editable-text";

import { UnifiedApplication, ApplicationStatus } from "@/types/unified-app";

export default function ApplicationDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: UnifiedApplication }>({
    queryKey: ["unified-app", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(params.id)}`);
      if (!response.ok) throw new Error("Failed to fetch application");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const app = data?.data;

  // Trigger Build mutation
  const triggerBuildMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(params.id)}/actions/build`, {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to trigger build");
      }
      return response.json();
    },
    onSuccess: () => {
      setActionMessage({ type: 'success', message: 'Build triggered successfully!' });
      setTimeout(() => setActionMessage(null), 3000);
      refetch();
    },
    onError: (error: Error) => {
      setActionMessage({ type: 'error', message: error.message });
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(params.id)}/actions/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "production" }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to deploy");
      }
      return response.json();
    },
    onSuccess: () => {
      setActionMessage({ type: 'success', message: 'Deployment initiated!' });
      setTimeout(() => setActionMessage(null), 3000);
      refetch();
    },
    onError: (error: Error) => {
      setActionMessage({ type: 'error', message: error.message });
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(params.id)}/actions/rollback`, {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to rollback");
      }
      return response.json();
    },
    onSuccess: () => {
      setActionMessage({ type: 'success', message: 'Rollback initiated!' });
      setTimeout(() => setActionMessage(null), 3000);
      refetch();
    },
    onError: (error: Error) => {
      setActionMessage({ type: 'error', message: error.message });
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  // Update application mutation
  const updateAppMutation = useMutation({
    mutationFn: async (updates: { name?: string; description?: string }) => {
      const response = await fetch(`/api/applications/${encodeURIComponent(params.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update application");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-app", params.id] });
      setActionMessage({ type: 'success', message: 'Application updated!' });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (error: Error) => {
      setActionMessage({ type: 'error', message: error.message });
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-32 bg-gray-800 rounded"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Application not found</h2>
          <p className="text-gray-400 mb-4">
            The application you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.
          </p>
          <Link href="/applications">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Applications
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: ApplicationStatus | string) => {
    const overallStatus = typeof status === 'object' ? status.overall : status;
    switch (overallStatus) {
      case "healthy":
      case "running":
      case "deployed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "unhealthy":
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ApplicationStatus | string) => {
    const overallStatus = typeof status === 'object' ? status.overall : status;
    switch (overallStatus) {
      case "healthy":
      case "running":
      case "deployed":
        return <Badge variant="default" className="bg-green-600">Healthy</Badge>;
      case "degraded":
      case "warning":
        return <Badge variant="warning">Degraded</Badge>;
      case "unhealthy":
      case "failed":
        return <Badge variant="error">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Get overall status string for display
  const overallStatus = typeof app.status === 'object' ? app.status.overall : app.status;

  // Get latest deployment info
  const latestDeployment = app.deployments?.[0];
  const latestCommit = app.repository?.latestCommit;

  const tabs = [
    { id: "overview", label: "Overview", icon: Code },
    { id: "metrics", label: "Metrics", icon: Activity },
    { id: "logs", label: "Logs", icon: Code },
    { id: "alerts", label: "Alerts", icon: AlertTriangle },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "releases", label: "Releases", icon: Tag },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "commits", label: "Commits", icon: GitCommit },
    { id: "pipelines", label: "Pipelines", icon: PlayCircle },
    { id: "deployments", label: "Deployments", icon: Rocket },
    { id: "errors", label: "Errors", icon: AlertTriangle },
    { id: "users", label: "Users", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "secrets", label: "Secrets", icon: Shield },
    { id: "integrations", label: "Integrations", icon: Package },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/applications" className="hover:text-gray-200">
          Applications
        </Link>
        <span>/</span>
        <span className="text-gray-200">{app.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-950/20 rounded-lg">
            <Code className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <EditableText
                value={app.name}
                onSave={async (name) => {
                  await updateAppMutation.mutateAsync({ name });
                }}
                as="h1"
                className="text-3xl font-bold"
                maxLength={100}
              />
              {getStatusBadge(app.status)}
              {app.tags?.includes("typescript") && (
                <Badge variant="secondary">TypeScript</Badge>
              )}
            </div>
            <p className="text-gray-400 mt-1">
              {app.repository?.fullName || app.slug}
            </p>
            <ProviderBadges
              gitProvider={app.repository?.provider}
              className="mt-2"
            />
            <EditableText
              value={app.description || ""}
              onSave={async (description) => {
                await updateAppMutation.mutateAsync({ description });
              }}
              as="p"
              className="text-gray-400 mt-2 max-w-2xl"
              placeholder="Add a description..."
              emptyText="Add a description..."
              multiline
              maxLength={500}
            />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <DeploymentTrigger
            appId={params.id}
            appName={app.name}
            currentCommit={latestCommit?.sha}
            variant="compact"
            onDeploymentComplete={(success) => {
              if (success) {
                setActionMessage({ type: 'success', message: 'Deployment completed successfully!' });
              } else {
                setActionMessage({ type: 'error', message: 'Deployment failed. Check logs for details.' });
              }
              setTimeout(() => setActionMessage(null), 5000);
            }}
          />
          {app.repository?.url && (
            <a href={app.repository.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <GitBranch className="h-4 w-4 mr-2" />
                Repository
              </Button>
            </a>
          )}
          {latestDeployment?.url && (
            <a href={latestDeployment.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Site
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
              <p className="text-lg font-semibold capitalize mt-1">{overallStatus}</p>
            </div>
            {getStatusIcon(app.status)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Branch</p>
              <p className="text-lg font-semibold mt-1">{app.repository?.defaultBranch || "main"}</p>
            </div>
            <GitBranch className="h-5 w-5 text-gray-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Last Commit</p>
              <p className="text-lg font-semibold font-mono mt-1">
                {latestCommit?.shortSha || "—"}
              </p>
            </div>
            <GitCommit className="h-5 w-5 text-gray-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">CI Status</p>
              <p className="text-lg font-semibold capitalize mt-1">
                {typeof app.status === 'object' ? app.status.ci : "—"}
              </p>
            </div>
            <PlayCircle className={`h-5 w-5 ${
              typeof app.status === 'object' && app.status.ci === "passing" ? "text-green-500" :
              typeof app.status === 'object' && app.status.ci === "failing" ? "text-red-500" :
              "text-gray-400"
            }`} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Environment</p>
              <p className="text-lg font-semibold capitalize mt-1">
                {latestDeployment?.environment || "—"}
              </p>
            </div>
            <Rocket className="h-5 w-5 text-gray-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Updated</p>
              <p className="text-lg font-semibold mt-1">
                {app.updatedAt
                  ? formatDistanceToNow(new Date(app.updatedAt), { addSuffix: false })
                  : "—"}
              </p>
            </div>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-gray-900">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 data-[state=active]:bg-gray-800"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Repository Info */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Repository
              </h2>
              <div className="space-y-3">
                {app.repository && (
                  <>
                    <div>
                      <p className="text-sm text-gray-400">Full Name</p>
                      <p className="font-medium">{app.repository.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Default Branch</p>
                      <p className="font-medium">{app.repository.defaultBranch}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">URL</p>
                      <a 
                        href={app.repository.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-blue-400 hover:underline"
                      >
                        {app.repository.url}
                      </a>
                    </div>
                  </>
                )}
                {latestCommit && (
                  <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Latest Commit</p>
                    <div className="flex items-start gap-2">
                      <code className="text-sm bg-gray-800 px-2 py-0.5 rounded">
                        {latestCommit.shortSha}
                      </code>
                      <p className="text-sm flex-1 truncate">{latestCommit.message}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      by {latestCommit.author?.name || "Unknown"} • {" "}
                      {latestCommit.timestamp 
                        ? formatDistanceToNow(new Date(latestCommit.timestamp), { addSuffix: true })
                        : "Unknown"}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Deployment Info */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Current Deployment
              </h2>
              {latestDeployment ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">Environment</p>
                    <Badge variant={latestDeployment.environment === "production" ? "error" : "warning"}>
                      {latestDeployment.environment}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">Status</p>
                    {getStatusBadge(latestDeployment.status)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Image</p>
                    <code className="text-sm">{latestDeployment.currentImage || "latest"}</code>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Replicas</p>
                    <p className="font-medium">
                      {latestDeployment.readyReplicas || 0} / {latestDeployment.replicas || 0} ready
                    </p>
                  </div>
                  {latestDeployment.lastDeployedAt && (
                    <div>
                      <p className="text-sm text-gray-400">Deployed</p>
                      <p className="font-medium">
                        {formatDistanceToNow(new Date(latestDeployment.lastDeployedAt), { addSuffix: true })}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">No deployments yet</p>
              )}
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              
              {/* Action Message */}
              {actionMessage && (
                <Alert className={`mb-4 ${actionMessage.type === 'success' ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                  <AlertDescription className={actionMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                    {actionMessage.message}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => triggerBuildMutation.mutate()}
                  disabled={triggerBuildMutation.isPending}
                >
                  <PlayCircle className={`h-4 w-4 mr-2 ${triggerBuildMutation.isPending ? 'animate-spin' : ''}`} />
                  {triggerBuildMutation.isPending ? 'Building...' : 'Trigger Build'}
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => deployMutation.mutate()}
                  disabled={deployMutation.isPending}
                >
                  <Rocket className={`h-4 w-4 mr-2 ${deployMutation.isPending ? 'animate-pulse' : ''}`} />
                  {deployMutation.isPending ? 'Deploying...' : 'Deploy'}
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setActiveTab('secrets')}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Add Secret
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => rollbackMutation.mutate()}
                  disabled={rollbackMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${rollbackMutation.isPending ? 'animate-spin' : ''}`} />
                  {rollbackMutation.isPending ? 'Rolling back...' : 'Rollback'}
                </Button>
              </div>
            </Card>

            {/* Status Summary */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">System Status</h2>
              {typeof app.status === 'object' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Repository</span>
                    <Badge variant={app.status.repository === 'connected' ? 'default' : 'error'}>
                      {app.status.repository}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">CI/CD</span>
                    <Badge variant={
                      app.status.ci === 'passing' ? 'default' : 
                      app.status.ci === 'failing' ? 'error' : 'secondary'
                    }>
                      {app.status.ci}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Staging</span>
                    <Badge variant={
                      app.status.staging === 'healthy' ? 'default' : 
                      app.status.staging === 'unhealthy' ? 'error' : 'secondary'
                    }>
                      {app.status.staging}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Production</span>
                    <Badge variant={
                      app.status.production === 'healthy' ? 'default' : 
                      app.status.production === 'unhealthy' ? 'error' : 'secondary'
                    }>
                      {app.status.production}
                    </Badge>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <MetricsTab appId={params.id} />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <LogsTab appId={params.id} />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <AlertsTab appId={params.id} />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <TaskBoard applicationId={params.id} />
        </TabsContent>

        {/* Releases Tab */}
        <TabsContent value="releases">
          <ReleaseList applicationId={params.id} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <ActivityTab appId={params.id} />
        </TabsContent>

        {/* Commits Tab */}
        <TabsContent value="commits">
          <CommitsTab appId={params.id} />
        </TabsContent>

        {/* Pipelines Tab */}
        <TabsContent value="pipelines">
          <PipelinesTab appId={params.id} />
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments">
          <DeploymentsTab appId={params.id} />
        </TabsContent>

        {/* Errors Tab - No appId prop needed */}
        <TabsContent value="errors">
          <ErrorsTab />
        </TabsContent>

        {/* Users Tab - No appId prop needed */}
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        {/* Analytics Tab - No appId prop needed */}
        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>

        {/* Payments Tab - No appId prop needed */}
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>

        {/* Secrets Tab */}
        <TabsContent value="secrets">
          <SecretsList applicationId={params.id} />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <IntegrationsList applicationId={params.id} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <ApplicationSettings applicationId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
