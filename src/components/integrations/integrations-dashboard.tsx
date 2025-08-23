'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  GitBranch, 
  Container, 
  Ship,
  Settings,
  Database,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  Edit,
  Play,
  Pause
} from 'lucide-react'

interface GiteaRepository {
  id: number
  name: string
  full_name: string
  description: string
  private: boolean
  html_url: string
  language: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  pushed_at: string
  created_at: string
}

interface Integration {
  id: string
  name: string
  type: 'gitea' | 'drone' | 'harbor' | 'argocd'
  status: 'healthy' | 'unhealthy' | 'warning'
  url: string
  version?: string
  lastCheck: string
  responseTime: number
  uptime: number
  features: string[]
  config?: Record<string, any>
}

interface IntegrationStats {
  repositories: number
  users: number
  organizations: number
  recentActivity: number
  builds: number
  deployments: number
  images: number
  vulnerabilities: number
}

const integrationIcons = {
  gitea: <GitBranch className="h-6 w-6 text-orange-500" />,
  drone: <Activity className="h-6 w-6 text-blue-500" />,
  harbor: <Container className="h-6 w-6 text-teal-500" />,
  argocd: <Ship className="h-6 w-6 text-purple-500" />
}

const statusColors = {
  healthy: 'text-green-600 bg-green-50 border-green-200',
  unhealthy: 'text-red-600 bg-red-50 border-red-200',
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200'
}

const statusIcons = {
  healthy: <CheckCircle className="h-4 w-4 text-green-500" />,
  unhealthy: <AlertTriangle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />
}

function IntegrationCard({ integration, stats, onAction }: {
  integration: Integration
  stats?: IntegrationStats
  onAction: (action: string, integrationId: string) => void
}) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <Card className={`${statusColors[integration.status]} transition-all duration-200 hover:shadow-md`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {integrationIcons[integration.type]}
            <div>
              <CardTitle className="text-lg">{integration.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{integration.type.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {statusIcons[integration.status]}
            <Badge variant={integration.status === 'healthy' ? 'success' : 'error'}>
              {integration.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Quick Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {integration.type === 'gitea' && (
                <>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.repositories}</div>
                    <div className="text-muted-foreground">Repositories</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.users}</div>
                    <div className="text-muted-foreground">Users</div>
                  </div>
                </>
              )}
              {integration.type === 'drone' && (
                <>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.builds}</div>
                    <div className="text-muted-foreground">Builds</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.recentActivity}</div>
                    <div className="text-muted-foreground">Recent</div>
                  </div>
                </>
              )}
              {integration.type === 'harbor' && (
                <>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.images}</div>
                    <div className="text-muted-foreground">Images</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.vulnerabilities}</div>
                    <div className="text-muted-foreground">Vulnerabilities</div>
                  </div>
                </>
              )}
              {integration.type === 'argocd' && (
                <>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.deployments}</div>
                    <div className="text-muted-foreground">Applications</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.recentActivity}</div>
                    <div className="text-muted-foreground">Synced</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Connection Info */}
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Uptime:</span>
              <div className="font-semibold">{integration.uptime.toFixed(2)}%</div>
            </div>
            <div>
              <span className="text-muted-foreground">Response:</span>
              <div className="font-semibold">{integration.responseTime}ms</div>
            </div>
            <div>
              <span className="text-muted-foreground">Version:</span>
              <div className="font-mono text-xs">{integration.version || 'Unknown'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Last Check:</span>
              <div>{new Date(integration.lastCheck).toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">Features:</div>
            <div className="flex flex-wrap gap-1">
              {integration.features.map((feature) => (
                <Badge key={feature} variant="outline" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.open(integration.url, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>

            {showDetails ? (
              <div onClick={() => setShowDetails(false)} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Integration Details: {integration.name}</h2>
                  <p className="text-sm text-gray-500">
                    Detailed configuration and status for {integration.type.toUpperCase()} integration
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Connection</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>URL:</strong> {integration.url}</div>
                        <div><strong>Status:</strong> {integration.status}</div>
                        <div><strong>Uptime:</strong> {integration.uptime.toFixed(2)}%</div>
                        <div><strong>Response Time:</strong> {integration.responseTime}ms</div>
                        <div><strong>Version:</strong> {integration.version || 'Unknown'}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Configuration</h4>
                      <div className="space-y-1 text-sm">
                        {integration.config && Object.entries(integration.config).map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {typeof value === 'string' ? value : JSON.stringify(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Available Features</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {integration.features.map((feature) => (
                        <Badge key={feature} variant="outline">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {stats && (
                    <div>
                      <h4 className="font-semibold mb-2">Statistics</h4>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        {Object.entries(stats).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <div className="text-lg font-bold">{value}</div>
                            <div className="text-muted-foreground capitalize">{key}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
          ) : null}

          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowDetails(true)}
          >
            <Eye className="h-3 w-3 mr-1" />
            Details
          </Button>

            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onAction('test', integration.id)}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Test
            </Button>

            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onAction('configure', integration.id)}
            >
              <Settings className="h-3 w-3 mr-1" />
              Config
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RepositoryCard({ repo }: { repo: GiteaRepository }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{repo.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{repo.full_name}</p>
          </div>
          <div className="flex space-x-1">
            <Badge variant={repo.private ? 'secondary' : 'default'} className="text-xs">
              {repo.private ? 'Private' : 'Public'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {repo.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{repo.description}</p>
          )}
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="font-semibold text-blue-600">{repo.stargazers_count}</div>
              <div className="text-muted-foreground">Stars</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{repo.forks_count}</div>
              <div className="text-muted-foreground">Forks</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-orange-600">{repo.open_issues_count}</div>
              <div className="text-muted-foreground">Issues</div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs">
            <Badge variant="outline">{repo.language}</Badge>
            <span className="text-muted-foreground">
              Updated {new Date(repo.pushed_at).toLocaleDateString()}
            </span>
          </div>

          <Button 
            size="sm" 
            variant="outline" 
            className="w-full"
            onClick={() => window.open(repo.html_url, '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View Repository
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

async function fetchIntegrations() {
  // Simulated data - in real implementation, this would fetch from multiple integration APIs
  return {
    integrations: [
      {
        id: 'gitea',
        name: 'Gitea Server',
        type: 'gitea' as const,
        status: 'healthy' as const,
        url: 'https://git.gmac.io',
        version: '1.20.4',
        lastCheck: new Date().toISOString(),
        responseTime: 120,
        uptime: 99.95,
        features: ['Git Hosting', 'Issue Tracking', 'CI/CD Integration', 'Wiki', 'Packages'],
        config: {
          'SSH Port': 22,
          'HTTP Port': 3000,
          'Database': 'PostgreSQL'
        }
      },
      {
        id: 'drone',
        name: 'Drone CI/CD',
        type: 'drone' as const,
        status: 'healthy' as const,
        url: 'https://ci.gmac.io',
        version: '2.18.0',
        lastCheck: new Date().toISOString(),
        responseTime: 85,
        uptime: 99.87,
        features: ['Pipeline Automation', 'Container Builds', 'Multi-arch', 'Secrets Management'],
        config: {
          'Server Mode': 'server',
          'Database': 'SQLite',
          'Runners': 3
        }
      },
      {
        id: 'harbor',
        name: 'Harbor Registry',
        type: 'harbor' as const,
        status: 'warning' as const,
        url: 'https://registry.gmac.io',
        version: '2.8.4',
        lastCheck: new Date().toISOString(),
        responseTime: 250,
        uptime: 98.92,
        features: ['Container Registry', 'Vulnerability Scanning', 'Policy Management', 'Replication'],
        config: {
          'Storage': 'S3',
          'Scan Engine': 'Trivy',
          'Projects': 12
        }
      },
      {
        id: 'argocd',
        name: 'ArgoCD',
        type: 'argocd' as const,
        status: 'healthy' as const,
        url: 'https://argocd.gmac.io',
        version: '2.8.4',
        lastCheck: new Date().toISOString(),
        responseTime: 95,
        uptime: 99.98,
        features: ['GitOps Deployment', 'Application Management', 'RBAC', 'Multi-cluster'],
        config: {
          'Sync Policy': 'Automated',
          'Clusters': 2,
          'Applications': 15
        }
      }
    ],
    stats: {
      gitea: { repositories: 12, users: 8, organizations: 3, recentActivity: 45 },
      drone: { builds: 156, recentActivity: 23 },
      harbor: { images: 89, vulnerabilities: 12 },
      argocd: { deployments: 15, recentActivity: 14 }
    }
  }
}

async function fetchGiteaRepositories() {
  const response = await fetch('/api/integrations/gitea?endpoint=repositories')
  if (!response.ok) throw new Error('Failed to fetch repositories')
  return response.json()
}

export default function IntegrationsDashboard() {
  const queryClient = useQueryClient()

  const { data: integrationData, isLoading: integrationsLoading } = useQuery({
    queryKey: ['integrations-overview'],
    queryFn: fetchIntegrations,
    refetchInterval: 60000
  })

  const { data: repoData, isLoading: reposLoading } = useQuery({
    queryKey: ['gitea-repositories'],
    queryFn: fetchGiteaRepositories,
    refetchInterval: 120000
  })

  const integrationActionMutation = useMutation({
    mutationFn: ({ action, integrationId }: { action: string; integrationId: string }) => {
      console.log(`Executing ${action} on ${integrationId}`)
      return Promise.resolve({ success: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-overview'] })
    }
  })

  const handleIntegrationAction = (action: string, integrationId: string) => {
    integrationActionMutation.mutate({ action, integrationId })
  }

  if (integrationsLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const integrations = integrationData?.integrations || []
  const stats = integrationData?.stats || {} as Record<string, any>
  const repositories = repoData?.repositories || []

  const healthyIntegrations = integrations.filter((i: Integration) => i.status === 'healthy').length
  const totalIntegrations = integrations.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Integrations</h2>
          <p className="text-muted-foreground">
            Manage connections to external services and tools
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      <Alert className={healthyIntegrations === totalIntegrations ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
        {healthyIntegrations === totalIntegrations ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        )}
        <AlertDescription>
          {healthyIntegrations}/{totalIntegrations} integrations are healthy
          {healthyIntegrations !== totalIntegrations && 
            ` - ${totalIntegrations - healthyIntegrations} require attention`
          }
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="ci-cd">CI/CD</TabsTrigger>
          <TabsTrigger value="registry">Registry</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {integrations.map((integration: Integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                stats={(stats as any)[integration.id]}
                onAction={handleIntegrationAction}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="repositories">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Git Repositories</h3>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Sync
                </Button>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Repository
                </Button>
              </div>
            </div>
            
            {reposLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-12 bg-gray-200 rounded animate-pulse" />
                        <div className="h-8 bg-gray-200 rounded animate-pulse" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {repositories.map((repo: GiteaRepository) => (
                  <RepositoryCard key={repo.id} repo={repo} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ci-cd">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {integrations
              .filter((i: Integration) => i.type === 'drone' || i.type === 'argocd')
              .map((integration: Integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  stats={(stats as any)[integration.id]}
                  onAction={handleIntegrationAction}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="registry">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {integrations
              .filter((i: Integration) => i.type === 'harbor')
              .map((integration: Integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  stats={(stats as any)[integration.id]}
                  onAction={handleIntegrationAction}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}