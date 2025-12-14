'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DeploymentManager } from '@/components/deployment/DeploymentManager';
import { DeploymentList } from '@/components/deployment/DeploymentList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  GitBranch, 
  Rocket, 
  Server, 
  Clock, 
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Settings,
  Play,
  ArrowRight,
  Database,
  Globe,
  Code,
  Layers,
  Users,
  Zap
} from 'lucide-react';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  updated_at: string;
  deployment_status?: {
    is_deployed: boolean;
    application_id?: string;
    environments: Array<{
      name: string;
      status: string;
      url?: string;
      version?: string;
    }>;
  };
}

interface Application {
  id: string;
  repository: Repository;
  environments: Array<{
    name: string;
    status: string;
    url?: string;
    version?: string;
    last_deployed?: string;
    config: {
      name: string;
      domain_suffix: string;
      replicas: number;
    };
  }>;
  deployment_config: {
    port: number;
    application_type?: string;
  };
}

export default function DeploymentsPage() {
  const searchParams = useSearchParams();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [deploymentStats, setDeploymentStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'applications');
  const [deployingApps, setDeployingApps] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [appsResponse, reposResponse] = await Promise.all([
        fetch('/api/deployments/applications?stats=true'),
        fetch('/api/deployments/repositories?deployment_status=true')
      ]);
      
      const appsData = await appsResponse.json();
      const reposData = await reposResponse.json();
      
      if (appsData.success) {
        setApplications(appsData.applications || []);
        setDeploymentStats(appsData.statistics);
      }
      
      if (reposData.success) {
        setRepositories(reposData.repositories || []);
      }
      
    } catch (error) {
      console.error('Failed to fetch deployment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const deployToEnvironment = async (applicationId: string, environment: string) => {
    setDeployingApps(prev => new Set(prev).add(`${applicationId}-${environment}`));
    
    try {
      const response = await fetch('/api/deployments/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          environment,
          options: { force: false },
        }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchData();
      }
    } catch (error) {
      console.error('Deployment error:', error);
    } finally {
      setDeployingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${applicationId}-${environment}`);
        return newSet;
      });
    }
  };

  const createApplicationDeployment = async (repositoryId: number, environments: string[]) => {
    try {
      const response = await fetch('/api/deployments/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository_id: repositoryId, environments }),
      });

      if (response.ok) await fetchData();
    } catch (error) {
      console.error('Error creating application deployment:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deploying': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'not_deployed': return <Clock className="h-4 w-4 text-gray-400" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getLanguageIcon = (language: string | null) => {
    switch (language?.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return <Code className="h-4 w-4 text-yellow-500" />;
      case 'python':
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'go':
        return <Zap className="h-4 w-4 text-cyan-500" />;
      default:
        return <Layers className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading deployments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deployments</h1>
          <p className="text-muted-foreground">
            Manage application deployments and GitOps workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Rocket className="h-4 w-4 mr-2" />
            Deploy New App
          </Button>
        </div>
      </div>

      {/* Deployment Statistics */}
      {deploymentStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Applications</p>
                  <p className="text-2xl font-bold">{deploymentStats.applications?.total || 0}</p>
                </div>
                <Server className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Deployments</p>
                  <p className="text-2xl font-bold">{deploymentStats.deployments?.byStatus?.deployed || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Production Apps</p>
                  <p className="text-2xl font-bold">{deploymentStats.deployments?.byEnvironment?.production || 0}</p>
                </div>
                <Globe className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed Deployments</p>
                  <p className="text-2xl font-bold">{deploymentStats.deployments?.byStatus?.failed || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="deploy">Deploy New</TabsTrigger>
          <TabsTrigger value="list">Deployed Apps</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <div className="grid gap-4">
            {applications.map((app) => (
              <Card key={app.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getLanguageIcon(app.repository.language)}
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {app.repository.name}
                          <a href={app.repository.html_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </CardTitle>
                        <CardDescription>
                          {app.repository.description || 'No description'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {app.repository.language || 'Unknown'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {app.environments.map((env) => (
                      <div key={env.name} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold capitalize">{env.name}</h4>
                            {getStatusIcon(env.status)}
                          </div>
                          <Badge variant={env.status === 'deployed' ? 'default' : 'secondary'}>
                            {env.status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            <span>{env.config.replicas} replicas</span>
                          </div>
                          
                          {env.url && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-3 w-3" />
                              <a href={env.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                {env.url.replace('https://', '')}
                              </a>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 mt-4">
                          <Button 
                            size="sm" 
                            onClick={() => deployToEnvironment(app.id, env.name)}
                            disabled={deployingApps.has(`${app.id}-${env.name}`)}
                          >
                            {deployingApps.has(`${app.id}-${env.name}`) ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3 mr-1" />
                            )}
                            Deploy
                          </Button>
                          
                          {env.status === 'deployed' && (
                            <Button size="sm" variant="outline">
                              <Activity className="h-3 w-3 mr-1" />
                              Logs
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {applications.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Applications Deployed</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by setting up deployment for one of your repositories.
                  </p>
                  <Button onClick={() => setActiveTab('repositories')}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Browse Repositories
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="repositories" className="space-y-4">
          <div className="grid gap-4">
            {repositories.map((repo) => (
              <Card key={repo.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getLanguageIcon(repo.language)}
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {repo.name}
                          <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </CardTitle>
                        <CardDescription>
                          {repo.description || 'No description'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {repo.language || 'Unknown'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </div>
                    
                    <div className="flex gap-2">
                      {repo.deployment_status?.is_deployed ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            {repo.deployment_status.environments.length} environments
                          </Badge>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-2" />
                            Manage
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => createApplicationDeployment(repo.id, ['development', 'staging'])}
                        >
                          <Rocket className="h-4 w-4 mr-2" />
                          Setup Deployment
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {repo.deployment_status?.environments && repo.deployment_status.environments.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {repo.deployment_status.environments.map((env) => (
                        <div key={env.name} className="flex items-center gap-1">
                          {getStatusIcon(env.status)}
                          <span className="text-sm text-muted-foreground capitalize">{env.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deploy">
          <DeploymentManager />
        </TabsContent>

        <TabsContent value="list">
          <DeploymentList />
        </TabsContent>
      </Tabs>
    </div>
  );
}