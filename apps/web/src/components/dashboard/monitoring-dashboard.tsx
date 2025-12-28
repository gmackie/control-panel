'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  RefreshCw,
  Download
} from 'lucide-react'

interface MonitoringAlert {
  id: string
  name: string
  status: 'firing' | 'pending' | 'resolved'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
  startTime: string
  endTime?: string
  labels: Record<string, string>
  silenced: boolean
  acknowledgedBy?: string
}

interface AlertStats {
  total: number
  firing: number
  pending: number
  resolved: number
  silenced: number
  bySeverity: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  mttr: number
}

interface MetricHistory {
  timestamp: string
  value: number
}

interface MetricData {
  id: string
  name: string
  value: number
  unit: string
  status: string
  history: MetricHistory[]
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316', 
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6'
}

const STATUS_COLORS = {
  firing: '#ef4444',
  pending: '#f97316',
  resolved: '#22c55e'
}

function AlertCard({ alert, onAcknowledge, onSilence }: { 
  alert: MonitoringAlert
  onAcknowledge: (alertId: string) => void
  onSilence: (alertId: string) => void
}) {
  const severityColors = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-green-600 bg-green-50 border-green-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200'
  }

  const statusIcons = {
    firing: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
    resolved: <CheckCircle className="h-4 w-4 text-green-500" />
  }

  return (
    <Card className={`${severityColors[alert.severity]} ${alert.silenced ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {statusIcons[alert.status]}
            <CardTitle className="text-sm">{alert.name}</CardTitle>
          </div>
          <div className="flex space-x-1">
            <Badge variant={alert.severity === 'critical' ? 'error' : 'warning'}>
              {alert.severity}
            </Badge>
            {alert.silenced && <Badge variant="outline">Silenced</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm">{alert.message}</p>
          
          <div className="text-xs text-muted-foreground">
            <div>Started: {new Date(alert.startTime).toLocaleString()}</div>
            {alert.endTime && (
              <div>Resolved: {new Date(alert.endTime).toLocaleString()}</div>
            )}
            {alert.acknowledgedBy && (
              <div>Acknowledged by: {alert.acknowledgedBy}</div>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {Object.entries(alert.labels).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs">
                {key}: {value}
              </Badge>
            ))}
          </div>

          {alert.status === 'firing' && (
            <div className="flex space-x-2 pt-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onAcknowledge(alert.id)}
                disabled={!!alert.acknowledgedBy}
              >
                <Eye className="h-3 w-3 mr-1" />
                {alert.acknowledgedBy ? 'Acknowledged' : 'Acknowledge'}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onSilence(alert.id)}
              >
                {alert.silenced ? <Bell className="h-3 w-3 mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                {alert.silenced ? 'Unsilence' : 'Silence'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MetricChart({ metric }: { metric: MetricData }) {
  const data = metric.history.map(point => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    value: point.value,
    name: metric.name
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{metric.name}</CardTitle>
        <div className="text-2xl font-bold">
          {metric.value.toFixed(1)}{metric.unit}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function AlertSeverityChart({ stats }: { stats: AlertStats }) {
  const data = [
    { name: 'Critical', value: stats.bySeverity.critical, color: SEVERITY_COLORS.critical },
    { name: 'High', value: stats.bySeverity.high, color: SEVERITY_COLORS.high },
    { name: 'Medium', value: stats.bySeverity.medium, color: SEVERITY_COLORS.medium },
    { name: 'Low', value: stats.bySeverity.low, color: SEVERITY_COLORS.low },
    { name: 'Info', value: stats.bySeverity.info, color: SEVERITY_COLORS.info }
  ].filter(item => item.value > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

async function fetchMonitoringData() {
  const response = await fetch('/api/monitoring/alerts?endpoint=alerts&limit=50')
  if (!response.ok) throw new Error('Failed to fetch monitoring data')
  return response.json()
}

async function fetchMetricsWithHistory() {
  const response = await fetch('/api/monitoring/metrics')
  if (!response.ok) throw new Error('Failed to fetch metrics')
  return response.json()
}

export default function MonitoringDashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const { data: alertData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['monitoring-alerts', filterSeverity, filterStatus],
    queryFn: fetchMonitoringData,
    refetchInterval: 30000
  })

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics-history', selectedTimeRange],
    queryFn: fetchMetricsWithHistory,
    refetchInterval: 15000
  })

  // Real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/stream/metrics?types=alert,metric&interval=5000')
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        if (update.type === 'alert') {
          refetchAlerts()
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }

    return () => eventSource.close()
  }, [refetchAlerts])

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge',
          alertIds: [alertId]
        })
      })
      refetchAlerts()
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const handleSilenceAlert = async (alertId: string) => {
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'silence',
          alertIds: [alertId],
          parameters: { duration: '1h', reason: 'Silenced from dashboard' }
        })
      })
      refetchAlerts()
    } catch (error) {
      console.error('Failed to silence alert:', error)
    }
  }

  if (alertsLoading || metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const alerts = alertData?.alerts || []
  const stats = alertData?.stats || {}
  const metrics = metricsData?.metrics || []

  const filteredAlerts = alerts.filter((alert: MonitoringAlert) => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false
    if (filterStatus !== 'all' && alert.status !== filterStatus) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monitoring Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time alerts and system metrics
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetchAlerts()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.firing || 0}</div>
            <div className="text-sm text-muted-foreground">Firing Alerts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.resolved || 0}</div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.silenced || 0}</div>
            <div className="text-sm text-muted-foreground">Silenced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.mttr || 0}</div>
            <div className="text-sm text-muted-foreground">MTTR (min)</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="w-full">
        <TabsList>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="metrics">System Metrics</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          {/* Filters */}
          <div className="flex space-x-2">
            <select 
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="firing">Firing</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {filteredAlerts.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No alerts found matching the current filters.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredAlerts.map((alert: MonitoringAlert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledgeAlert}
                  onSilence={handleSilenceAlert}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {metrics.slice(0, 6).map((metric: MetricData) => (
              <MetricChart key={metric.id} metric={metric} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AlertSeverityChart stats={stats} />
            <Card>
              <CardHeader>
                <CardTitle>Alert Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  Alert trend analytics coming soon
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}