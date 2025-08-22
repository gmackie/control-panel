'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Bell, 
  BellRing, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  AlertCircle,
  Activity,
  Server,
  GitBranch,
  Container,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  category: 'system' | 'deployment' | 'alert' | 'integration' | 'user'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actions?: Array<{
    label: string
    action: () => void
    variant?: 'default' | 'destructive' | 'outline'
  }>
  metadata?: {
    source?: string
    severity?: 'low' | 'medium' | 'high' | 'critical'
    tags?: string[]
  }
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

const notificationIcons = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />
}

const categoryIcons = {
  system: <Server className="h-4 w-4" />,
  deployment: <Activity className="h-4 w-4" />,
  alert: <AlertTriangle className="h-4 w-4" />,
  integration: <GitBranch className="h-4 w-4" />,
  user: <Bell className="h-4 w-4" />
}

function NotificationItem({ 
  notification, 
  onMarkRead, 
  onRemove 
}: { 
  notification: Notification
  onMarkRead: (id: string) => void
  onRemove: (id: string) => void 
}) {
  const typeColors = {
    success: 'border-l-green-500 bg-green-50/50',
    error: 'border-l-red-500 bg-red-50/50',
    warning: 'border-l-yellow-500 bg-yellow-50/50',
    info: 'border-l-blue-500 bg-blue-50/50'
  }

  return (
    <div
      className={cn(
        'border-l-4 p-4 transition-all duration-200',
        typeColors[notification.type],
        !notification.read && 'bg-opacity-100 shadow-sm',
        notification.read && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between space-x-3">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            {notificationIcons[notification.type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="text-sm font-medium">{notification.title}</h4>
              <Badge variant="outline" className="text-xs">
                {notification.category}
              </Badge>
              {notification.metadata?.severity && (
                <Badge 
                  variant={notification.metadata.severity === 'critical' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {notification.metadata.severity}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
            
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{notification.timestamp.toLocaleTimeString()}</span>
              </div>
              {notification.metadata?.source && (
                <div className="flex items-center space-x-1">
                  {categoryIcons[notification.category]}
                  <span>{notification.metadata.source}</span>
                </div>
              )}
            </div>

            {notification.metadata?.tags && notification.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {notification.metadata.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {notification.actions && (
              <div className="flex space-x-2 mt-3">
                {notification.actions.map((action, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={action.variant || 'outline'}
                    onClick={action.action}
                    className="text-xs"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {!notification.read && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onMarkRead(notification.id)}
              className="h-6 w-6 p-0"
            >
              <CheckCircle className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(notification.id)}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false
    }
    setNotifications(prev => [newNotification, ...prev])
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    )
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  // Connect to SSE for real-time notifications
  useEffect(() => {
    const eventSource = new EventSource('/api/stream/metrics?types=alert,deployment,health&interval=10000')
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        
        if (update.type === 'alert' && update.data.alert) {
          const alert = update.data.alert
          if (alert.status === 'firing') {
            addNotification({
              type: alert.severity === 'critical' ? 'error' : 'warning',
              category: 'alert',
              title: alert.name,
              message: alert.message,
              metadata: {
                source: alert.source,
                severity: alert.severity,
                tags: Object.values(alert.labels)
              },
              actions: [
                {
                  label: 'View Alert',
                  action: () => console.log('Navigate to alert:', alert.id)
                },
                {
                  label: 'Acknowledge',
                  action: () => console.log('Acknowledge alert:', alert.id)
                }
              ]
            })
          }
        }

        if (update.type === 'deployment' && update.data) {
          const deployment = update.data
          addNotification({
            type: deployment.status === 'deployed' ? 'success' : 
                  deployment.status === 'failed' ? 'error' : 'info',
            category: 'deployment',
            title: `Deployment ${deployment.status}`,
            message: `Application ${deployment.application} ${deployment.message}`,
            metadata: {
              source: 'ArgoCD',
              tags: [deployment.version]
            }
          })
        }

        if (update.type === 'health' && update.data) {
          const health = update.data
          if (health.status !== 'healthy') {
            addNotification({
              type: health.status === 'unhealthy' ? 'error' : 'warning',
              category: 'system',
              title: 'Service Health Alert',
              message: `${health.service} status changed to ${health.status}`,
              metadata: {
                source: 'Health Monitor'
              }
            })
          }
        }
      } catch (error) {
        console.error('Error parsing notification:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('Notification stream error:', error)
    }

    return () => eventSource.close()
  }, [])

  // Add some demo notifications on mount
  useEffect(() => {
    const demoNotifications = [
      {
        type: 'info' as const,
        category: 'system' as const,
        title: 'System Update',
        message: 'Cluster nodes are being updated to the latest version',
        metadata: { source: 'K3s Cluster' }
      },
      {
        type: 'success' as const,
        category: 'deployment' as const,
        title: 'Deployment Successful',
        message: 'control-panel v1.2.3 has been deployed successfully',
        metadata: { source: 'ArgoCD', tags: ['v1.2.3'] }
      }
    ]

    demoNotifications.forEach(notification => {
      setTimeout(() => addNotification(notification), Math.random() * 2000)
    })
  }, [])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function NotificationBell() {
  const { unreadCount } = useNotifications()

  return (
    <div className="relative">
      {unreadCount > 0 ? (
        <BellRing className="h-5 w-5" />
      ) : (
        <Bell className="h-5 w-5" />
      )}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </div>
  )
}

export function NotificationPanel({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean
  onClose: () => void 
}) {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    removeNotification, 
    clearAll 
  } = useNotifications()

  if (!isOpen) return null

  const recentNotifications = notifications.slice(0, 50)

  return (
    <Card className="absolute right-0 top-full mt-2 w-96 max-h-[600px] z-50 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
          </CardTitle>
          <div className="flex space-x-1">
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={clearAll}>
              Clear all
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {recentNotifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-0">
              {recentNotifications.map((notification, index) => (
                <div key={notification.id}>
                  <NotificationItem
                    notification={notification}
                    onMarkRead={markAsRead}
                    onRemove={removeNotification}
                  />
                  {index < recentNotifications.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// Toast notification component for immediate alerts
export function NotificationToast({ 
  notification, 
  onClose 
}: { 
  notification: Notification
  onClose: () => void 
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  const typeColors = {
    success: 'border-green-500 bg-green-50 text-green-900',
    error: 'border-red-500 bg-red-50 text-red-900',
    warning: 'border-yellow-500 bg-yellow-50 text-yellow-900',
    info: 'border-blue-500 bg-blue-50 text-blue-900'
  }

  return (
    <Card className={cn(
      'fixed bottom-4 right-4 w-96 shadow-lg border-l-4 z-50 animate-in slide-in-from-right',
      typeColors[notification.type]
    )}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {notificationIcons[notification.type]}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium">{notification.title}</h4>
            <p className="text-sm opacity-80 mt-1">{notification.message}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}