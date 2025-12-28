'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Layers,
  Wifi,
  WifiOff,
  BarChart3,
  LineChart,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface MetricHistory {
  timestamp: string
  value: number
}

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
  history: MetricHistory[]
}

interface MetricsResponse {
  metrics: SystemMetric[]
  totalCount: number
  source: 'prometheus' | 'mock'
  prometheusHealthy: boolean
  timeRange: string
  lastUpdated: string
}

async function fetchMetrics(timeRange: string): Promise<MetricsResponse> {
  const response = await fetch(`/api/monitoring/metrics?timeRange=${timeRange}`)
  if (!response.ok) {
    throw new Error('Failed to fetch metrics')
  }
  return response.json()
}

function MiniChart({ data, color = 'text-blue-400' }: { data: MetricHistory[], color?: string }) {
  if (!data || data.length < 2) {
    return <div className="h-12 w-full bg-gray-800/50 rounded animate-pulse" />
  }

  const values = data.map(d => d.value)
  const maxValue = Math.max(...values)
  const minValue = Math.min(...values)
  const range = maxValue - minValue || 1

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((point.value - minValue) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="h-12 w-full relative">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${data[0]?.timestamp}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon
          fill={`url(#gradient-${data[0]?.timestamp})`}
          points={`0,100 ${points} 100,100`}
          className={color}
        />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
          className={color}
        />
      </svg>
    </div>
  )
}

function MetricCard({ metric }: { metric: SystemMetric }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400'
      case 'warning': return 'text-yellow-400'
      case 'critical': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'warning': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/30'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    }
  }

  const getMetricIcon = (id: string) => {
    switch (id) {
      case 'cpu': return <Cpu className="h-5 w-5 text-blue-400" />
      case 'memory': return <MemoryStick className="h-5 w-5 text-purple-400" />
      case 'disk': return <HardDrive className="h-5 w-5 text-orange-400" />
      case 'network-rx': 
      case 'network-tx': return <Network className="h-5 w-5 text-cyan-400" />
      case 'nodes': return <Server className="h-5 w-5 text-green-400" />
      case 'pods': return <Layers className="h-5 w-5 text-indigo-400" />
      case 'container-restarts': return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      default: return <Activity className="h-5 w-5 text-gray-400" />
    }
  }

  const usagePercent = metric.threshold.critical > 0 
    ? (metric.value / metric.threshold.critical) * 100 
    : 0

  return (
    <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getMetricIcon(metric.id)}
            <div>
              <h3 className="font-medium text-gray-100">{metric.name}</h3>
              <p className="text-xs text-gray-500">{metric.source}</p>
            </div>
          </div>
          <Badge className={`border ${getStatusBadge(metric.status)}`}>
            {metric.status}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-3xl font-bold ${getStatusColor(metric.status)}`}>
                {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
                <span className="text-lg text-gray-500 ml-1">{metric.unit}</span>
              </p>
              {metric.change !== 0 && (
                <div className={`flex items-center gap-1 text-sm mt-1 ${
                  metric.change > 0 ? 'text-red-400' : 'text-green-400'
                }`}>
                  {metric.change > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{Math.abs(metric.change).toFixed(1)} from last hour</span>
                </div>
              )}
            </div>
          </div>

          {metric.threshold.critical > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Usage</span>
                <span className="text-gray-300">{usagePercent.toFixed(1)}%</span>
              </div>
              <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    metric.status === 'critical' ? 'bg-red-500' :
                    metric.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
                <div 
                  className="absolute top-0 h-full w-0.5 bg-yellow-500/50"
                  style={{ left: `${(metric.threshold.warning / metric.threshold.critical) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span className="text-yellow-500">{metric.threshold.warning}</span>
                <span className="text-red-500">{metric.threshold.critical}</span>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>History</span>
              <span>
                {metric.lastUpdated && formatDistanceToNow(new Date(metric.lastUpdated), { addSuffix: true })}
              </span>
            </div>
            <MiniChart 
              data={metric.history} 
              color={getStatusColor(metric.status)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="w-48 h-6 mb-2" />
            <Skeleton className="w-64 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-6">
                <Skeleton className="w-full h-6 mb-4" />
                <Skeleton className="w-24 h-10 mb-4" />
                <Skeleton className="w-full h-2 mb-4" />
                <Skeleton className="w-full h-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MetricsPage() {
  const [timeRange, setTimeRange] = useState('1h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(['cpu', 'memory', 'disk', 'network-rx', 'network-tx', 'pods', 'nodes', 'container-restarts'])
  )

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['metrics', timeRange],
    queryFn: () => fetchMetrics(timeRange),
    refetchInterval: autoRefresh ? 30000 : false,
  })

  const toggleMetricSelection = (metricId: string) => {
    const newSelected = new Set(selectedMetrics)
    if (newSelected.has(metricId)) {
      newSelected.delete(metricId)
    } else {
      newSelected.add(metricId)
    }
    setSelectedMetrics(newSelected)
  }

  const filteredMetrics = data?.metrics.filter(m => selectedMetrics.has(m.id)) || []

  const statusCounts = {
    healthy: filteredMetrics.filter(m => m.status === 'healthy').length,
    warning: filteredMetrics.filter(m => m.status === 'warning').length,
    critical: filteredMetrics.filter(m => m.status === 'critical').length,
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-red-900/20 border-red-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Failed to load metrics</span>
              </div>
              <p className="text-gray-400 mb-4">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
              <Button onClick={() => refetch()} variant="outline" className="border-red-700">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">System Metrics</h1>
              <p className="text-sm text-gray-400">
                Real-time infrastructure monitoring from {data?.source === 'prometheus' ? 'Prometheus' : 'Mock Data'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge 
              className={`flex items-center gap-1.5 ${
                data?.prometheusHealthy 
                  ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
              } border`}
            >
              {data?.prometheusHealthy ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {data?.prometheusHealthy ? 'Prometheus Connected' : 'Using Mock Data'}
            </Badge>

            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? '' : 'border-gray-700'}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={timeRange} onValueChange={setTimeRange}>
            <TabsList className="bg-gray-900 border border-gray-800">
              <TabsTrigger value="1h" className="data-[state=active]:bg-gray-800">1 Hour</TabsTrigger>
              <TabsTrigger value="24h" className="data-[state=active]:bg-gray-800">24 Hours</TabsTrigger>
              <TabsTrigger value="7d" className="data-[state=active]:bg-gray-800">7 Days</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={viewMode !== 'grid' ? 'border-gray-700' : ''}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode !== 'list' ? 'border-gray-700' : ''}
            >
              <LineChart className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="bg-gray-900/50 border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filter metrics:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data?.metrics.map(metric => (
              <Button
                key={metric.id}
                variant={selectedMetrics.has(metric.id) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleMetricSelection(metric.id)}
                className={`flex items-center gap-2 ${
                  !selectedMetrics.has(metric.id) ? 'border-gray-700 text-gray-400' : ''
                }`}
              >
                {metric.name}
                {selectedMetrics.has(metric.id) ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
              </Button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <div>
                  <div className="text-2xl font-bold text-blue-400">{filteredMetrics.length}</div>
                  <div className="text-xs text-gray-400">Total Metrics</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <div>
                  <div className="text-2xl font-bold text-green-400">{statusCounts.healthy}</div>
                  <div className="text-xs text-gray-400">Healthy</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{statusCounts.warning}</div>
                  <div className="text-xs text-gray-400">Warning</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <div>
                  <div className="text-2xl font-bold text-red-400">{statusCounts.critical}</div>
                  <div className="text-xs text-gray-400">Critical</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {filteredMetrics.length === 0 ? (
          <Card className="bg-gray-900/50 border-gray-800 p-8 text-center">
            <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Metrics Selected</h3>
            <p className="text-gray-500">
              Select metrics from the filter above to start monitoring.
            </p>
          </Card>
        ) : (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
              : 'grid-cols-1'
          }`}>
            {filteredMetrics.map(metric => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        )}

        <div className="text-center text-xs text-gray-500">
          Last updated: {data?.lastUpdated && formatDistanceToNow(new Date(data.lastUpdated), { addSuffix: true })}
          {autoRefresh && ' • Auto-refreshing every 30s'}
        </div>
      </div>
    </div>
  )
}
