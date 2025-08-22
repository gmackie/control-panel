'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAlerts } from '@/lib/api'
import { Alert } from '@/types'
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

export default function AlertsPanel() {
  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="card-header">Active Alerts</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const activeAlerts = alerts?.filter((alert) => alert.status === 'firing') || []
  const resolvedAlerts = alerts?.filter((alert) => alert.status === 'resolved') || []

  const severityIcon = {
    critical: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  }

  const severityColor = {
    critical: 'border-red-900 bg-red-900/20',
    warning: 'border-yellow-900 bg-yellow-900/20',
    info: 'border-blue-900 bg-blue-900/20',
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Alerts</h2>
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-gray-400">Active:</span>
          <span className={`font-medium ${activeAlerts.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {activeAlerts.length}
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activeAlerts.length === 0 && resolvedAlerts.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-400">No alerts at this time</p>
          </div>
        )}

        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border ${severityColor[alert.severity]}`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {severityIcon[alert.severity]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-sm">{alert.name}</h3>
                  <span className="text-xs text-gray-400">
                    {formatTime(alert.startsAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{alert.summary}</p>
                {alert.description && (
                  <p className="text-xs text-gray-400 mt-1">{alert.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {resolvedAlerts.length > 0 && activeAlerts.length > 0 && (
          <div className="border-t border-gray-800 pt-3 mt-3">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Recently Resolved</h3>
          </div>
        )}

        {resolvedAlerts.slice(0, 3).map((alert) => (
          <div key={alert.id} className="p-3 rounded-lg border border-gray-800 opacity-60">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{alert.name}</h3>
                  <span className="text-xs text-gray-500">
                    Resolved {alert.endsAt ? formatTime(alert.endsAt) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{alert.summary}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}