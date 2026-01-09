"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Layers,
  Database,
  GitBranch,
  Package,
  Smartphone,
  Cloud,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Globe,
  Server,
  Activity,
  GitPullRequest,
  AlertCircle,
  Rocket,
  Box,
  Upload,
  Zap,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface VercelData {
  user: { username: string; email: string } | null;
  projects: Array<{
    id: string;
    name: string;
    framework: string | null;
    updatedAt: number;
    link: { type: string; repo: string; org: string; productionBranch: string } | null;
  }>;
  deployments: Array<{
    uid: string;
    name: string;
    url: string;
    state: string;
    target: string;
    created: number;
  }>;
  summary: {
    totalProjects: number;
    totalDeployments: number;
    deploymentsLast24h: number;
    failedDeployments: number;
    successRate: number;
  };
}

interface NeonData {
  projects: Array<{
    project: {
      id: string;
      name: string;
      region_id: string;
      pg_version: number;
    };
    branches: Array<{
      id: string;
      name: string;
      current_state: string;
      logical_size: number;
      primary: boolean;
    }>;
    endpoints: Array<{
      id: string;
      host: string;
      current_state: string;
      pooler_enabled: boolean;
    }>;
    databases: Array<{ id: number; name: string; owner_name: string }>;
  }>;
  summary: {
    totalProjects: number;
    totalBranches: number;
    totalEndpoints: number;
    totalDatabases: number;
    activeEndpoints: number;
    totalStorageMB: number;
    totalComputeHours: number;
  };
}

interface GitHubData {
  user: { login: string; avatar_url: string; public_repos: number } | null;
  repositories: Array<{
    repo: {
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      open_issues_count: number;
      pushed_at: string;
    };
    issues: Array<{
      id: number;
      number: number;
      title: string;
      state: string;
      html_url: string;
    }>;
    releases: Array<{
      id: number;
      tag_name: string;
      name: string;
      html_url: string;
      published_at: string;
    }>;
  }>;
  rateLimit: {
    limit: number;
    remaining: number;
    resetIn: number;
  };
  summary: {
    totalRepos: number;
    publicRepos: number;
    privateRepos: number;
    totalStars: number;
    totalOpenIssues: number;
    openIssuesFetched: number;
    totalReleases: number;
    languages: Array<{ language: string; count: number }>;
  };
}

interface GiteaData {
  user: { login: string; full_name: string } | null;
  serverUrl: string;
  repositories: Array<{
    repo: {
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
      language: string | null;
      stars_count: number;
      open_issues_count: number;
      open_pr_counter: number;
    };
    workflowRuns: Array<{
      id: number;
      workflow_name: string;
      status: string;
      conclusion: string;
      head_branch: string;
      html_url: string;
      created_at: string;
    }>;
    pullRequests: Array<{
      id: number;
      number: number;
      title: string;
      state: string;
      html_url: string;
    }>;
    issues: Array<{
      id: number;
      number: number;
      title: string;
      state: string;
      html_url: string;
    }>;
  }>;
  summary: {
    totalRepos: number;
    totalOpenIssues: number;
    totalOpenPRs: number;
    openIssuesFetched: number;
    openPRsFetched: number;
    workflowStats: {
      total: number;
      success: number;
      failure: number;
      inProgress: number;
      queued: number;
    };
  };
}

interface TursoData {
  organizations: Array<{
    slug: string;
    name: string;
    databases: Array<{
      name: string;
      hostname: string;
      group: string;
      primaryRegion: string;
      regions: string[];
      sleeping: boolean;
    }>;
    groups: Array<{
      name: string;
      primary: string;
      locations: string[];
    }>;
  }>;
  summary: {
    totalOrganizations: number;
    totalDatabases: number;
    totalGroups: number;
    totalInstances: number;
    activeDatabases: number;
    sleepingDatabases: number;
    regions: string[];
    regionCount: number;
    totalStorageMB: number;
    totalStorageGB: number;
  };
}

interface ExpoData {
  accounts: Array<{
    id: string;
    name: string;
    projectCount: number;
    projects: Array<{
      id: string;
      slug: string;
      name: string;
      fullName: string;
      platforms: string[];
      sdkVersion: string;
      builds: Array<{
        id: string;
        status: string;
        platform: string;
        buildProfile: string;
        appVersion: string;
        createdAt: string;
        completedAt: string | null;
        error: string | null;
      }>;
      submissions: Array<{
        id: string;
        status: string;
        platform: string;
        createdAt: string;
      }>;
      updates: Array<{
        id: string;
        platform: string;
        message: string;
        branch: string;
        createdAt: string;
      }>;
    }>;
  }>;
  summary: {
    totalAccounts: number;
    totalProjects: number;
    totalBuilds: number;
    totalSubmissions: number;
    totalUpdates: number;
    platforms: string[];
    activeBuilds: number;
    failedBuilds: number;
    successfulBuilds: number;
    recentBuilds: Array<{
      id: string;
      status: string;
      platform: string;
      createdAt: string;
    }>;
  };
}

interface OrgIntegration {
  id: string;
  provider: string;
  name: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown> | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderConfig {
  name: string;
  icon: string;
  description: string;
  docsUrl?: string;
  fields: { key: string; label: string; type: string; placeholder: string; secret?: boolean }[];
  configFields?: { key: string; label: string; type: string; placeholder: string }[];
}

const PROVIDERS: Record<string, ProviderConfig> = {
  vercel: {
    name: "Vercel",
    icon: "▲",
    description: "Deploy and host web applications",
    docsUrl: "https://vercel.com/docs/rest-api",
    fields: [
      { key: "token", label: "API Token", type: "password", placeholder: "Bearer token from Vercel", secret: true },
    ],
    configFields: [
      { key: "teamId", label: "Team ID (optional)", type: "text", placeholder: "team_xxx" },
    ],
  },
  expo: {
    name: "Expo",
    icon: "📱",
    description: "Build and deploy React Native apps",
    docsUrl: "https://docs.expo.dev/",
    fields: [
      { key: "token", label: "Access Token", type: "password", placeholder: "Expo access token", secret: true },
    ],
    configFields: [
      { key: "username", label: "Username (optional)", type: "text", placeholder: "@username" },
    ],
  },
  neon: {
    name: "Neon",
    icon: "🐘",
    description: "Serverless Postgres with branching",
    docsUrl: "https://neon.tech/docs",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Neon API key", secret: true },
    ],
  },
  turso: {
    name: "Turso",
    icon: "🗄️",
    description: "Edge SQLite with global replication",
    docsUrl: "https://docs.turso.tech/",
    fields: [
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Turso platform API token", secret: true },
    ],
    configFields: [
      { key: "organization", label: "Organization (optional)", type: "text", placeholder: "my-org" },
    ],
  },
  github: {
    name: "GitHub",
    icon: "🐙",
    description: "Source code hosting and CI/CD",
    docsUrl: "https://docs.github.com/en/rest",
    fields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "ghp_xxx", secret: true },
    ],
    configFields: [
      { key: "org", label: "Organization (optional)", type: "text", placeholder: "my-org" },
    ],
  },
  gitea: {
    name: "Gitea",
    icon: "🍵",
    description: "Self-hosted Git service",
    docsUrl: "https://docs.gitea.com/",
    fields: [
      { key: "token", label: "API Token", type: "password", placeholder: "Gitea access token", secret: true },
      { key: "url", label: "Gitea URL", type: "text", placeholder: "https://git.example.com" },
    ],
  },
  hetzner: {
    name: "Hetzner Cloud",
    icon: "☁️",
    description: "Cloud servers, volumes, and networking",
    docsUrl: "https://docs.hetzner.cloud/",
    fields: [
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Hetzner Cloud API token", secret: true },
    ],
    configFields: [
      { key: "defaultLocation", label: "Default Location (optional)", type: "text", placeholder: "fsn1, nbg1, hel1, ash, hil" },
    ],
  },
  aws: {
    name: "Amazon Web Services",
    icon: "🔶",
    description: "Lambda, S3, SQS, SNS, IoT, and more",
    docsUrl: "https://docs.aws.amazon.com/",
    fields: [
      { key: "awsExport", label: "Paste AWS Export Commands", type: "textarea", placeholder: "export AWS_ACCESS_KEY_ID=\"...\"\nexport AWS_SECRET_ACCESS_KEY=\"...\"\nexport AWS_SESSION_TOKEN=\"...\"", secret: false },
    ],
    configFields: [
      { key: "region", label: "Default Region", type: "text", placeholder: "us-east-1" },
    ],
  },
};

function NotConfiguredCard({ service, icon: Icon, onSetup }: { service: string; icon: React.ElementType; onSetup?: () => void }) {
  return (
    <Card className="p-8 text-center">
      <Icon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">{service} not configured</h3>
      <p className="text-gray-400 mb-4">Configure this integration in the Setup tab</p>
      <Button variant="outline" onClick={onSetup}>
        <Settings className="h-4 w-4 mr-2" />
        Go to Setup
      </Button>
    </Card>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
}

export default function IntegrationsDashboardPage() {
  const [activeTab, setActiveTab] = useState("vercel");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const queryClient = useQueryClient();

  const { data: vercelData, isLoading: vercelLoading, error: vercelError, refetch: refetchVercel } = useQuery<VercelData>({
    queryKey: ['integrations', 'vercel'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/data/vercel');
      if (res.status === 404) throw new Error('not_configured');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
    retry: false,
  });

  const { data: neonData, isLoading: neonLoading, error: neonError, refetch: refetchNeon } = useQuery<NeonData>({
    queryKey: ['integrations', 'neon'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/data/neon');
      if (res.status === 404) throw new Error('not_configured');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
    retry: false,
  });

  const { data: githubData, isLoading: githubLoading, error: githubError, refetch: refetchGitHub } = useQuery<GitHubData>({
    queryKey: ['integrations', 'github'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/data/github');
      if (res.status === 404) throw new Error('not_configured');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
    retry: false,
  });

  const { data: giteaData, isLoading: giteaLoading, error: giteaError, refetch: refetchGitea } = useQuery<GiteaData>({
    queryKey: ['integrations', 'gitea'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/data/gitea');
      if (res.status === 404) throw new Error('not_configured');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
    retry: false,
  });

  const { data: tursoData, isLoading: tursoLoading, error: tursoError, refetch: refetchTurso } = useQuery<TursoData>({
    queryKey: ['integrations', 'turso'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/data/turso');
      if (res.status === 404) throw new Error('not_configured');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
    retry: false,
  });

  const { data: expoData, isLoading: expoLoading, error: expoError, refetch: refetchExpo } = useQuery<ExpoData>({
    queryKey: ['integrations', 'expo'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/data/expo');
      if (res.status === 404) throw new Error('not_configured');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
    retry: false,
  });

  const { data: orgIntegrations, isLoading: orgIntegrationsLoading } = useQuery<OrgIntegration[]>({
    queryKey: ["org-integrations"],
    queryFn: async () => {
      const response = await fetch("/api/integrations/org");
      if (!response.ok) throw new Error("Failed to fetch integrations");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { provider: string; name: string; credentials: Record<string, string>; config?: Record<string, string> }) => {
      const response = await fetch("/api/integrations/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create integration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
      setShowAddModal(false);
      setSelectedProvider(null);
      setFormData({});
      setTestResult(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/integrations/org/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete integration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingId(id);
      const response = await fetch(`/api/integrations/org/${id}/sync`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-integrations"] });
    },
    onSettled: () => {
      setSyncingId(null);
    },
  });

  const parseAWSExportCommands = (exportText: string): Record<string, string> => {
    const credentials: Record<string, string> = {};
    const lines = exportText.split('\n');
    
    for (const line of lines) {
      const match = line.match(/export\s+(AWS_\w+)=["']?([^"'\n]+)["']?/);
      if (match) {
        const [, key, value] = match;
        if (key === 'AWS_ACCESS_KEY_ID') credentials.accessKeyId = value;
        else if (key === 'AWS_SECRET_ACCESS_KEY') credentials.secretAccessKey = value;
        else if (key === 'AWS_SESSION_TOKEN') credentials.sessionToken = value;
      }
    }
    
    return credentials;
  };

  const handleAddIntegration = () => {
    if (!selectedProvider) return;
    const provider = PROVIDERS[selectedProvider];

    let credentials: Record<string, string> = {};
    const config: Record<string, string> = {};

    if (selectedProvider === 'aws' && formData.awsExport) {
      credentials = parseAWSExportCommands(formData.awsExport);
    } else {
      provider.fields.forEach(field => {
        if (formData[field.key]) {
          credentials[field.key] = formData[field.key];
        }
      });
    }

    provider.configFields?.forEach(field => {
      if (formData[field.key]) {
        config[field.key] = formData[field.key];
      }
    });

    createMutation.mutate({
      provider: selectedProvider,
      name: formData.name || provider.name,
      credentials,
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    const provider = PROVIDERS[selectedProvider];

    let credentials: Record<string, string> = {};
    const config: Record<string, string> = {};

    if (selectedProvider === 'aws' && formData.awsExport) {
      credentials = parseAWSExportCommands(formData.awsExport);
    } else {
      provider.fields.forEach(field => {
        if (formData[field.key]) {
          credentials[field.key] = formData[field.key];
        }
      });
    }

    provider.configFields?.forEach(field => {
      if (formData[field.key]) {
        config[field.key] = formData[field.key];
      }
    });

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/integrations/org/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, credentials, config }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTestResult({ success: false, message: data.error || "Connection failed" });
      } else {
        setTestResult({ success: true, message: data.message || "Connection successful" });
      }
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderInfo = (provider: string) => PROVIDERS[provider] || { name: provider, icon: "🔌", description: "" };

  const handleRefreshAll = () => {
    refetchVercel();
    refetchNeon();
    refetchGitHub();
    refetchGitea();
    refetchTurso();
    refetchExpo();
  };

  const totalProjects = (vercelData?.summary?.totalProjects || 0) +
    (neonData?.summary?.totalProjects || 0) +
    (githubData?.summary?.totalRepos || 0) +
    (giteaData?.summary?.totalRepos || 0) +
    (expoData?.summary?.totalProjects || 0);

  const totalDatabases = (neonData?.summary?.totalDatabases || 0) +
    (tursoData?.summary?.totalDatabases || 0);

  const activeBuilds = (expoData?.summary?.activeBuilds || 0);

  const openIssues = (githubData?.summary?.openIssuesFetched || 0) +
    (giteaData?.summary?.openIssuesFetched || 0);

  const isNotConfigured = (error: Error | null) => error?.message === 'not_configured';

  const getDeploymentBadge = (state: string) => {
    switch (state) {
      case 'READY':
        return <Badge variant="success" className="text-xs">Ready</Badge>;
      case 'ERROR':
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      case 'BUILDING':
        return <Badge variant="warning" className="text-xs">Building</Badge>;
      case 'QUEUED':
        return <Badge variant="secondary" className="text-xs">Queued</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{state}</Badge>;
    }
  };

  const getBuildStatusBadge = (status: string) => {
    switch (status) {
      case 'finished':
        return <Badge variant="success" className="text-xs">Success</Badge>;
      case 'errored':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="warning" className="text-xs">In Progress</Badge>;
      case 'in_queue':
      case 'new':
        return <Badge variant="secondary" className="text-xs">Queued</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getWorkflowBadge = (conclusion: string, status: string) => {
    if (status === 'in_progress') {
      return <Badge variant="warning" className="text-xs">Running</Badge>;
    }
    if (status === 'queued') {
      return <Badge variant="secondary" className="text-xs">Queued</Badge>;
    }
    switch (conclusion) {
      case 'success':
        return <Badge variant="success" className="text-xs">Success</Badge>;
      case 'failure':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{conclusion || status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Integrations Dashboard</h1>
          <p className="text-gray-400">
            Monitor all third-party service integrations
          </p>
        </div>
        <Button onClick={handleRefreshAll} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Projects</span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{totalProjects}</p>
          <p className="text-xs text-gray-500">across all services</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Databases</span>
            <Database className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{totalDatabases}</p>
          <p className="text-xs text-gray-500">Neon + Turso</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Active Builds</span>
            <Rocket className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold">{activeBuilds}</p>
          <p className="text-xs text-gray-500">Expo builds in progress</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Open Issues</span>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">{openIssues}</p>
          <p className="text-xs text-gray-500">GitHub + Gitea</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="vercel" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Vercel
          </TabsTrigger>
          <TabsTrigger value="neon" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Neon
          </TabsTrigger>
          <TabsTrigger value="github" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="gitea" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Gitea
          </TabsTrigger>
          <TabsTrigger value="turso" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Turso
          </TabsTrigger>
          <TabsTrigger value="expo" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Expo
          </TabsTrigger>
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vercel" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold">Vercel</h3>
              {vercelData?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{vercelData.summary.totalProjects} projects</Badge>
                  <Badge variant="outline">{vercelData.summary.successRate}% success</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchVercel()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {vercelLoading ? (
            <LoadingSpinner />
          ) : isNotConfigured(vercelError as Error | null) ? (
            <NotConfiguredCard service="Vercel" icon={Cloud} onSetup={() => setActiveTab("setup")} />
          ) : vercelData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-400">Projects</span>
                  </div>
                  <p className="text-2xl font-bold">{vercelData.summary.totalProjects}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-400">Deployments (24h)</span>
                  </div>
                  <p className="text-2xl font-bold">{vercelData.summary.deploymentsLast24h}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-400">Success Rate</span>
                  </div>
                  <p className="text-2xl font-bold">{vercelData.summary.successRate}%</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-gray-400">Failed</span>
                  </div>
                  <p className="text-2xl font-bold">{vercelData.summary.failedDeployments}</p>
                </Card>
              </div>

              <Card className="p-6">
                <h4 className="font-semibold mb-4">Recent Deployments</h4>
                <div className="space-y-3">
                  {vercelData.deployments.slice(0, 10).map((deployment) => (
                    <div key={deployment.uid} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Rocket className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="font-medium">{deployment.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(deployment.created), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{deployment.target}</Badge>
                        {getDeploymentBadge(deployment.state)}
                        <a href={`https://${deployment.url}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 text-gray-500 hover:text-gray-300" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h4 className="font-semibold mb-4">Projects</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vercelData.projects.map((project) => (
                    <Card key={project.id} className="p-4 bg-gray-900">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="font-medium">{project.name}</h5>
                          {project.framework && (
                            <Badge variant="outline" className="text-xs mt-1">{project.framework}</Badge>
                          )}
                        </div>
                      </div>
                      {project.link && (
                        <p className="text-xs text-gray-500 mt-2">
                          {project.link.org}/{project.link.repo}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load Vercel data</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="neon" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold">Neon</h3>
              {neonData?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{neonData.summary.totalDatabases} databases</Badge>
                  <Badge variant="outline">{neonData.summary.totalStorageMB.toFixed(1)} MB</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchNeon()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {neonLoading ? (
            <LoadingSpinner />
          ) : isNotConfigured(neonError as Error | null) ? (
            <NotConfiguredCard service="Neon" icon={Database} onSetup={() => setActiveTab("setup")} />
          ) : neonData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-400">Projects</span>
                  </div>
                  <p className="text-2xl font-bold">{neonData.summary.totalProjects}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-400">Databases</span>
                  </div>
                  <p className="text-2xl font-bold">{neonData.summary.totalDatabases}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-gray-400">Branches</span>
                  </div>
                  <p className="text-2xl font-bold">{neonData.summary.totalBranches}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-gray-400">Active Endpoints</span>
                  </div>
                  <p className="text-2xl font-bold">{neonData.summary.activeEndpoints}</p>
                </Card>
              </div>

              <Card className="p-6">
                <h4 className="font-semibold mb-4">Projects & Databases</h4>
                <div className="space-y-4">
                  {neonData.projects.map((p) => (
                    <Card key={p.project.id} className="p-4 bg-gray-900">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h5 className="font-medium">{p.project.name}</h5>
                          <p className="text-xs text-gray-500">
                            PostgreSQL {p.project.pg_version} | {p.project.region_id}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="p-2 bg-gray-800 rounded">
                          <span className="text-gray-400">Branches:</span>{' '}
                          <span className="font-medium">{p.branches.length}</span>
                        </div>
                        <div className="p-2 bg-gray-800 rounded">
                          <span className="text-gray-400">Endpoints:</span>{' '}
                          <span className="font-medium">{p.endpoints.length}</span>
                        </div>
                        <div className="p-2 bg-gray-800 rounded">
                          <span className="text-gray-400">Databases:</span>{' '}
                          <span className="font-medium">{p.databases.length}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load Neon data</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="github" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold">GitHub</h3>
              {githubData?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{githubData.summary.totalRepos} repos</Badge>
                  <Badge variant="outline">{githubData.summary.totalStars} stars</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchGitHub()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {githubLoading ? (
            <LoadingSpinner />
          ) : isNotConfigured(githubError as Error | null) ? (
            <NotConfiguredCard service="GitHub" icon={GitBranch} onSetup={() => setActiveTab("setup")} />
          ) : githubData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Repositories</span>
                  </div>
                  <p className="text-2xl font-bold">{githubData.summary.totalRepos}</p>
                  <p className="text-xs text-gray-500">
                    {githubData.summary.publicRepos} public / {githubData.summary.privateRepos} private
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-gray-400">Open Issues</span>
                  </div>
                  <p className="text-2xl font-bold">{githubData.summary.totalOpenIssues}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Box className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-400">Releases</span>
                  </div>
                  <p className="text-2xl font-bold">{githubData.summary.totalReleases}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-400">Rate Limit</span>
                  </div>
                  <p className="text-2xl font-bold">{githubData.rateLimit.remaining}/{githubData.rateLimit.limit}</p>
                  <p className="text-xs text-gray-500">resets in {Math.round(githubData.rateLimit.resetIn / 60)}m</p>
                </Card>
              </div>

              <Card className="p-6">
                <h4 className="font-semibold mb-4">Repositories</h4>
                <div className="space-y-3">
                  {githubData.repositories.map((r) => (
                    <div key={r.repo.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-gray-500" />
                        <div>
                          <a href={r.repo.html_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                            {r.repo.name}
                          </a>
                          <p className="text-xs text-gray-500">
                            {r.repo.language && <Badge variant="outline" className="text-xs mr-2">{r.repo.language}</Badge>}
                            Updated {formatDistanceToNow(new Date(r.repo.pushed_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.repo.private ? 'secondary' : 'outline'} className="text-xs">
                          {r.repo.private ? 'Private' : 'Public'}
                        </Badge>
                        {r.repo.open_issues_count > 0 && (
                          <Badge variant="warning" className="text-xs">{r.repo.open_issues_count} issues</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load GitHub data</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gitea" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold">Gitea</h3>
              {giteaData?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{giteaData.summary.totalRepos} repos</Badge>
                  <Badge variant="outline">{giteaData.summary.totalOpenPRs} PRs</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchGitea()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {giteaLoading ? (
            <LoadingSpinner />
          ) : isNotConfigured(giteaError as Error | null) ? (
            <NotConfiguredCard service="Gitea" icon={Server} onSetup={() => setActiveTab("setup")} />
          ) : giteaData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Repositories</span>
                  </div>
                  <p className="text-2xl font-bold">{giteaData.summary.totalRepos}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GitPullRequest className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-gray-400">Open PRs</span>
                  </div>
                  <p className="text-2xl font-bold">{giteaData.summary.totalOpenPRs}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-gray-400">Open Issues</span>
                  </div>
                  <p className="text-2xl font-bold">{giteaData.summary.totalOpenIssues}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-400">CI Runs</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {giteaData.summary.workflowStats.success}/{giteaData.summary.workflowStats.total}
                  </p>
                  <p className="text-xs text-gray-500">successful</p>
                </Card>
              </div>

              {giteaData.repositories.some(r => r.workflowRuns.length > 0) && (
                <Card className="p-6">
                  <h4 className="font-semibold mb-4">Recent Workflow Runs</h4>
                  <div className="space-y-3">
                    {giteaData.repositories.flatMap(r =>
                      r.workflowRuns.map(run => ({ ...run, repoName: r.repo.name }))
                    ).slice(0, 10).map((run) => (
                      <div key={run.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Zap className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium">{run.workflow_name}</p>
                            <p className="text-xs text-gray-500">
                              {run.repoName} / {run.head_branch}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getWorkflowBadge(run.conclusion, run.status)}
                          <a href={run.html_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 text-gray-500 hover:text-gray-300" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h4 className="font-semibold mb-4">Repositories</h4>
                <div className="space-y-3">
                  {giteaData.repositories.map((r) => (
                    <div key={r.repo.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-gray-500" />
                        <div>
                          <a href={r.repo.html_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                            {r.repo.name}
                          </a>
                          {r.repo.language && (
                            <Badge variant="outline" className="text-xs ml-2">{r.repo.language}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.repo.open_pr_counter > 0 && (
                          <Badge variant="secondary" className="text-xs">{r.repo.open_pr_counter} PRs</Badge>
                        )}
                        {r.repo.open_issues_count > 0 && (
                          <Badge variant="warning" className="text-xs">{r.repo.open_issues_count} issues</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load Gitea data</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="turso" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-semibold">Turso</h3>
              {tursoData?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{tursoData.summary.totalDatabases} databases</Badge>
                  <Badge variant="outline">{tursoData.summary.regionCount} regions</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchTurso()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {tursoLoading ? (
            <LoadingSpinner />
          ) : isNotConfigured(tursoError as Error | null) ? (
            <NotConfiguredCard service="Turso" icon={Database} onSetup={() => setActiveTab("setup")} />
          ) : tursoData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-gray-400">Databases</span>
                  </div>
                  <p className="text-2xl font-bold">{tursoData.summary.totalDatabases}</p>
                  <p className="text-xs text-gray-500">
                    {tursoData.summary.activeDatabases} active / {tursoData.summary.sleepingDatabases} sleeping
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-gray-400">Groups</span>
                  </div>
                  <p className="text-2xl font-bold">{tursoData.summary.totalGroups}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-400">Regions</span>
                  </div>
                  <p className="text-2xl font-bold">{tursoData.summary.regionCount}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-400">Storage</span>
                  </div>
                  <p className="text-2xl font-bold">{tursoData.summary.totalStorageMB.toFixed(1)} MB</p>
                </Card>
              </div>

              {tursoData.organizations.map((org) => (
                <Card key={org.slug} className="p-6">
                  <h4 className="font-semibold mb-4">{org.name}</h4>
                  <div className="space-y-3">
                    {org.databases.map((db) => (
                      <div key={db.name} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Database className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium">{db.name}</p>
                            <p className="text-xs text-gray-500">
                              {db.primaryRegion} | {db.group}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {db.regions.length > 1 && (
                            <Badge variant="outline" className="text-xs">{db.regions.length} regions</Badge>
                          )}
                          <Badge variant={db.sleeping ? 'secondary' : 'success'} className="text-xs">
                            {db.sleeping ? 'Sleeping' : 'Active'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </>
          ) : (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load Turso data</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expo" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-violet-400" />
              <h3 className="text-lg font-semibold">Expo</h3>
              {expoData?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{expoData.summary.totalProjects} projects</Badge>
                  <Badge variant="outline">{expoData.summary.totalBuilds} builds</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchExpo()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {expoLoading ? (
            <LoadingSpinner />
          ) : isNotConfigured(expoError as Error | null) ? (
            <NotConfiguredCard service="Expo" icon={Smartphone} onSetup={() => setActiveTab("setup")} />
          ) : expoData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-violet-400" />
                    <span className="text-sm text-gray-400">Projects</span>
                  </div>
                  <p className="text-2xl font-bold">{expoData.summary.totalProjects}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="h-4 w-4 text-orange-400" />
                    <span className="text-sm text-gray-400">Builds</span>
                  </div>
                  <p className="text-2xl font-bold">{expoData.summary.totalBuilds}</p>
                  <p className="text-xs text-gray-500">
                    {expoData.summary.activeBuilds} active / {expoData.summary.failedBuilds} failed
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-400">Submissions</span>
                  </div>
                  <p className="text-2xl font-bold">{expoData.summary.totalSubmissions}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-400">Updates</span>
                  </div>
                  <p className="text-2xl font-bold">{expoData.summary.totalUpdates}</p>
                </Card>
              </div>

              {expoData.summary.recentBuilds.length > 0 && (
                <Card className="p-6">
                  <h4 className="font-semibold mb-4">Recent Builds</h4>
                  <div className="space-y-3">
                    {expoData.summary.recentBuilds.map((build) => (
                      <div key={build.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Rocket className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium">{build.id.slice(0, 8)}...</p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(build.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{build.platform}</Badge>
                          {getBuildStatusBadge(build.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h4 className="font-semibold mb-4">Projects</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {expoData.accounts.flatMap(a => a.projects).map((project) => (
                    <Card key={project.id} className="p-4 bg-gray-900">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="font-medium">{project.name}</h5>
                          <p className="text-xs text-gray-500">{project.fullName}</p>
                        </div>
                        <div className="flex gap-1">
                          {project.platforms?.map(p => (
                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                        <div className="p-2 bg-gray-800 rounded text-center">
                          <p className="font-bold">{project.builds.length}</p>
                          <p className="text-xs text-gray-500">Builds</p>
                        </div>
                        <div className="p-2 bg-gray-800 rounded text-center">
                          <p className="font-bold">{project.submissions.length}</p>
                          <p className="text-xs text-gray-500">Submissions</p>
                        </div>
                        <div className="p-2 bg-gray-800 rounded text-center">
                          <p className="font-bold">{project.updates.length}</p>
                          <p className="text-xs text-gray-500">Updates</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load Expo data</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold">Integration Setup</h3>
              {orgIntegrations && (
                <Badge variant="outline">
                  {orgIntegrations.filter(i => i.enabled).length} connected
                </Badge>
              )}
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Connected Services</h2>
                <p className="text-sm text-gray-400">
                  {orgIntegrations?.filter(i => i.enabled).length || 0} integration{(orgIntegrations?.filter(i => i.enabled).length || 0) !== 1 ? "s" : ""} active
                </p>
              </div>
            </div>

            {orgIntegrationsLoading ? (
              <LoadingSpinner />
            ) : orgIntegrations && orgIntegrations.length > 0 ? (
              <div className="space-y-3">
                {orgIntegrations.map((integration) => {
                  const providerInfo = getProviderInfo(integration.provider);
                  const isSyncing = syncingId === integration.id;

                  return (
                    <div
                      key={integration.id}
                      className="p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-gray-800 rounded-lg flex items-center justify-center text-2xl">
                            {providerInfo.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{integration.name}</h3>
                              <Badge variant={integration.enabled ? "default" : "secondary"}>
                                {integration.enabled ? "Active" : "Disabled"}
                              </Badge>
                              {integration.lastSyncStatus === "success" && (
                                <Badge variant="outline" className="text-green-500 border-green-500/30">
                                  <Check className="h-3 w-3 mr-1" />
                                  Synced
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">{providerInfo.description}</p>
                            {integration.lastSyncAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                              </p>
                            )}
                            {integration.lastSyncError && (
                              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {integration.lastSyncError}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {providerInfo.docsUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={providerInfo.docsUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncMutation.mutate(integration.id)}
                            disabled={isSyncing}
                          >
                            <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                            {isSyncing ? "Syncing..." : "Sync"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => {
                              if (confirm("Delete this integration? This cannot be undone.")) {
                                deleteMutation.mutate(integration.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Settings className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No integrations configured</h3>
                <p className="text-gray-400 mb-6">
                  Connect your external services to get started
                </p>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Integration
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Available Integrations</h2>
            <p className="text-sm text-gray-400 mb-6">
              {Object.keys(PROVIDERS).length} integrations available to connect
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(PROVIDERS).map(([key, provider]) => {
                const connectedCount = orgIntegrations?.filter(i => i.provider === key && i.enabled).length || 0;
                const isConnected = connectedCount > 0;
                const supportsMultiple = key === 'hetzner';
                return (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      isConnected
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
                    }`}
                    onClick={() => {
                      if (!isConnected || supportsMultiple) {
                        setSelectedProvider(key);
                        setShowAddModal(true);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xl ${
                        isConnected ? "bg-green-500/20" : "bg-gray-800"
                      }`}>
                        {provider.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{provider.name}</p>
                          {isConnected && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                          {supportsMultiple && connectedCount > 0 && (
                            <span className="text-xs text-gray-500">({connectedCount})</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {provider.description}
                          {supportsMultiple && " (supports multiple)"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false);
          setSelectedProvider(null);
          setFormData({});
          setTestResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl">
              {selectedProvider ? `Connect ${PROVIDERS[selectedProvider]?.name}` : "Add Integration"}
            </DialogTitle>
            <DialogDescription>
              {selectedProvider
                ? "Enter your credentials to connect this service"
                : "Select a service to connect to your organization"}
            </DialogDescription>
          </DialogHeader>

          {!selectedProvider ? (
            <div className="grid grid-cols-2 gap-3 pt-4">
              {Object.entries(PROVIDERS).map(([key, provider]) => {
                const connectedCount = orgIntegrations?.filter(i => i.provider === key && i.enabled).length || 0;
                const isConnected = connectedCount > 0;
                const supportsMultiple = key === 'hetzner';
                const isDisabled = isConnected && !supportsMultiple;
                return (
                  <button
                    key={key}
                    onClick={() => !isDisabled && setSelectedProvider(key)}
                    disabled={isDisabled}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      isDisabled
                        ? "border-green-500/30 bg-green-500/5 cursor-not-allowed opacity-60"
                        : isConnected && supportsMultiple
                        ? "border-green-500/30 bg-green-500/5 hover:border-blue-500 hover:bg-gray-800/50"
                        : "border-gray-700 hover:border-blue-500 hover:bg-gray-800/50 hover:shadow-sm"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xl ${
                      isConnected ? "bg-green-500/20" : "bg-gray-800"
                    }`}>
                      {provider.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{provider.name}</p>
                        {isConnected && <Check className="h-4 w-4 text-green-500" />}
                        {supportsMultiple && connectedCount > 0 && (
                          <span className="text-xs text-gray-500">({connectedCount})</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{provider.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="h-12 w-12 rounded-lg bg-gray-900 flex items-center justify-center text-2xl shadow-sm">
                  {PROVIDERS[selectedProvider].icon}
                </div>
                <div>
                  <p className="font-semibold">{PROVIDERS[selectedProvider].name}</p>
                  <p className="text-sm text-gray-400">{PROVIDERS[selectedProvider].description}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    placeholder={PROVIDERS[selectedProvider].name}
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">A friendly name to identify this integration</p>
                </div>

                {PROVIDERS[selectedProvider].fields.map((field) => (
                  <div key={field.key} className="grid gap-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.key}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="font-mono text-sm min-h-[120px] w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                      />
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="font-mono"
                      />
                    )}
                  </div>
                ))}

                {PROVIDERS[selectedProvider].configFields && PROVIDERS[selectedProvider].configFields.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-gray-700">
                    <p className="text-sm font-medium text-gray-400">Optional Configuration</p>
                    {PROVIDERS[selectedProvider].configFields?.map((field) => (
                      <div key={field.key} className="grid gap-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={formData[field.key] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${
                  testResult.success
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}>
                  {testResult.success ? <Check className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                  <div>
                    <p className="font-medium">{testResult.success ? "Connection Successful" : "Connection Failed"}</p>
                    <p className="text-xs opacity-80 mt-0.5">{testResult.message}</p>
                  </div>
                </div>
              )}

              {createMutation.isError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Failed to Save</p>
                    <p className="text-xs opacity-80 mt-0.5">{createMutation.error?.message || "Failed to connect integration"}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 pt-4">
            {selectedProvider ? (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSelectedProvider(null);
                    setFormData({});
                    setTestResult(null);
                  }}
                >
                  Back
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !PROVIDERS[selectedProvider].fields.every(f => formData[f.key])}
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : "Test Connection"}
                </Button>
                <Button
                  onClick={handleAddIntegration}
                  disabled={createMutation.isPending || !PROVIDERS[selectedProvider].fields.every(f => formData[f.key])}
                >
                  {createMutation.isPending ? "Connecting..." : "Connect"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
