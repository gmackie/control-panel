'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity, 
  Server, 
  Database, 
  GitBranch, 
  Container,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

interface SystemMetric {
  id: string
  name: string
  value: number
  unit: string
  change: number
  status: 'healthy' | 'warning' | 'critical'
  threshold: {
    warning: number
    critical: number
  }
  lastUpdated: string
  source: string
  history?: Array<{
    timestamp: string
    value: number
  }>
}

interface ServiceHealth {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  responseTime: number
  errorRate: number
  lastCheck: string
}

interface InfrastructureData {
  metrics: SystemMetric[]
  services: ServiceHealth[]
  totalCount: number
  lastUpdated: string
}

const statusColors = {
  healthy: 'text-green-600',
  warning: 'text-yellow-600', 
  critical: 'text-red-600',
  degraded: 'text-orange-600',
  unhealthy: 'text-red-600'
}

const statusBadgeVariants = {
  healthy: 'default',
  warning: 'warning',
  critical: 'error',
  degraded: 'warning',
  unhealthy: 'error'
} as const

function formatValue(value: number, unit: string): string {
  if (unit === '%') {
    return `${value.toFixed(1)}%`
  }
  if (unit === 'ms') {
    return `${value.toFixed(0)}ms`
  }
  if (unit === '') {
    return Math.round(value).toLocaleString()
  }
  return `${value.toFixed(2)} ${unit}`
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'warning':
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'critical':
    case 'unhealthy':
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

function MetricCard({ metric }: { metric: SystemMetric }) {
  const isIncreasing = metric.change > 0
  const changeColor = isIncreasing ? 'text-green-600' : 'text-red-600'
  const TrendIcon = isIncreasing ? TrendingUp : TrendingDown
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
        {getStatusIcon(metric.status)}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(metric.value, metric.unit)}</div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <TrendIcon className={`h-3 w-3 ${changeColor}`} />
          <span className={changeColor}>
            {Math.abs(metric.change).toFixed(1)}%
          </span>
          <span>from last hour</span>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span>Warning: {formatValue(metric.threshold.warning, metric.unit)}</span>
            <span>Critical: {formatValue(metric.threshold.critical, metric.unit)}</span>
          </div>
          <Progress 
            value={(metric.value / metric.threshold.critical) * 100}
            className="h-2"
          />
        </div>
        <Badge variant={statusBadgeVariants[metric.status]} className="mt-2">
          {metric.status}
        </Badge>
      </CardContent>
    </Card>
  )
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
        {getStatusIcon(service.status)}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Uptime</span>
            <span className="text-sm font-medium">{service.uptime.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Response Time</span>
            <span className="text-sm font-medium">{service.responseTime}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Error Rate</span>
            <span className="text-sm font-medium">{service.errorRate.toFixed(2)}%</span>
          </div>
          <Badge variant={statusBadgeVariants[service.status]} className="w-full justify-center">
            {service.status.toUpperCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

async function fetchInfrastructureData(): Promise<InfrastructureData> {
  const [metricsResponse, healthResponse] = await Promise.all([
    fetch('/api/monitoring/metrics'),
    fetch('/api/monitoring/health')
  ])

  if (!metricsResponse.ok || !healthResponse.ok) {
    throw new Error('Failed to fetch infrastructure data')
  }

  const [metricsData, healthData] = await Promise.all([
    metricsResponse.json(),
    healthResponse.json()
  ])

  return {
    metrics: metricsData.metrics || [],
    services: healthData.services || [],
    totalCount: metricsData.totalCount || 0,
    lastUpdated: metricsData.lastUpdated || new Date().toISOString()
  }
}

export default function InfrastructureOverview() {
  const [selectedSource, setSelectedSource] = useState<string>('all')
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['infrastructure-overview', selectedSource],
    queryFn: fetchInfrastructureData,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000 // Consider data stale after 15 seconds
  })

  // Real-time updates via SSE
  useEffect(() => {
    const eventSource = new EventSource('/api/stream/metrics?types=metric,health&interval=5000')
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        if (update.type === 'metric' || update.type === 'health') {
          refetch()
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
    }

    return () => {
      eventSource.close()
    }
  }, [refetch])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-2 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load infrastructure data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No infrastructure data available.
        </AlertDescription>
      </Alert>
    )
  }

  const criticalMetrics = data.metrics?.filter(m => m.status === 'critical') || []
  const warningMetrics = data.metrics?.filter(m => m.status === 'warning') || []
  const unhealthyServices = data.services?.filter(s => s.status === 'unhealthy') || []

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Infrastructure Overview</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of your infrastructure components
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Last Updated</div>
          <div className="text-sm font-medium">
            {data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {(criticalMetrics.length > 0 || unhealthyServices.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical Issues Detected:</strong>
            {criticalMetrics.length > 0 && ` ${criticalMetrics.length} critical metrics`}
            {criticalMetrics.length > 0 && unhealthyServices.length > 0 && ', '}
            {unhealthyServices.length > 0 && ` ${unhealthyServices.length} unhealthy services`}
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Alerts */}
      {warningMetrics.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warnings:</strong> {warningMetrics.length} metrics require attention
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={selectedSource} onValueChange={setSelectedSource} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Metrics</TabsTrigger>
          <TabsTrigger value="k3s-cluster">Cluster</TabsTrigger>
          <TabsTrigger value="api-gateway">Gateway</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {/* System Metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              System Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.metrics?.map(metric => (
                <MetricCard key={metric.id} metric={metric} />
              ))}
            </div>
          </div>

          {/* Service Health */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Server className="h-5 w-5 mr-2" />
              Service Health
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.services?.map(service => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="k3s-cluster">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metrics?.filter(m => m.source === 'k3s-cluster').map(metric => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api-gateway">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metrics?.filter(m => m.source === 'api-gateway').map(metric => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="database">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metrics?.filter(m => m.source === 'database').map(metric => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}