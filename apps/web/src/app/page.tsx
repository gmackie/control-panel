'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Plus,
  ChevronRight,
  AlertTriangle,
  XCircle,
  Rocket,
  Activity,
  Clock,
  Code,
} from 'lucide-react'
import RevenueMetrics from '@/components/RevenueMetrics'
import AppServicesGrid from '@/components/AppServicesGrid'
import CustomerMetrics from '@/components/CustomerMetrics'
import DatabaseStatus from '@/components/DatabaseStatus'
import RecentDeployments from '@/components/RecentDeployments'
import UsageAnalytics from '@/components/UsageAnalytics'
import { SystemHealth } from '@/components/dashboard/system-health'
import { RealtimeMetrics } from '@/components/dashboard/realtime-metrics'
import { ClerkAuthMetrics } from '@/components/dashboard/clerk-auth-metrics'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { PipelineStatusWidget } from '@/components/dashboard/pipeline-status-widget'
import { CostOverview } from '@/components/dashboard/cost-overview'
import { TasksWidget } from '@/components/dashboard/tasks-widget'
import { ProviderBadges } from '@/components/applications/ProviderBadges'
import { fetchBusinessMetrics } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface UnhealthyApp {
  id: string;
  name: string;
  slug: string;
  status: string;
  gitProvider?: string;
  deployProvider?: string;
  lastDeployedAt?: string;
}

interface RecentActivityItem {
  id: string;
  type: 'deployment' | 'alert' | 'created';
  applicationName: string;
  applicationId: string;
  message: string;
  status?: string;
  timestamp: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const { data: metrics } = useQuery({
    queryKey: ['business-metrics'],
    queryFn: fetchBusinessMetrics,
    enabled: !!session,
  })

  const { data: unhealthyApps } = useQuery<UnhealthyApp[]>({
    queryKey: ['unhealthy-apps'],
    queryFn: async () => {
      const response = await fetch('/api/apps?status=unhealthy&limit=5')
      if (!response.ok) return []
      const data = await response.json()
      return data.applications || []
    },
    enabled: !!session,
  })

  const { data: recentActivity } = useQuery<RecentActivityItem[]>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const response = await fetch('/api/activity?limit=10')
      if (!response.ok) return []
      const data = await response.json()
      return data.activities || []
    },
    enabled: !!session,
  })

  useEffect(() => {
    setIsLoading(false)
  }, [])

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">GMAC.IO Control Panel</h1>
          <p className="text-muted-foreground mb-6">Please sign in to access the control panel.</p>
          <a 
            href="/api/auth/signin/github"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Sign in with GitHub
          </a>
        </div>
      </div>
    )
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deployment':
        return <Rocket className="h-4 w-4 text-blue-400" />
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />
      case 'created':
        return <Plus className="h-4 w-4 text-green-400" />
      default:
        return <Activity className="h-4 w-4 text-zinc-400" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Overview of your infrastructure and applications</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/applications/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="hidden sm:inline">Create New App</span>
              <span className="sm:hidden">New App</span>
            </Button>
          </Link>
          <Link href="/applications" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto">
              <span className="hidden sm:inline">View All Apps</span>
              <span className="sm:hidden">All Apps</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <DashboardStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(unhealthyApps && unhealthyApps.length > 0) && (
          <Card className="p-4 border-yellow-600/30 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold">Applications Requiring Attention</h3>
              </div>
              <Link href="/applications?filter=unhealthy">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {unhealthyApps.slice(0, 3).map((app) => (
                <Link key={app.id} href={`/applications/${app.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <XCircle className="h-4 w-4 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium">{app.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <ProviderBadges
                            gitProvider={app.gitProvider}
                            deployProvider={app.deployProvider}
                            size="sm"
                          />
                          <span className="text-xs text-zinc-500">
                            {app.lastDeployedAt && formatDistanceToNow(new Date(app.lastDeployedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="error">{app.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card className={`p-4 ${unhealthyApps && unhealthyApps.length > 0 ? '' : 'lg:col-span-3'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Recent Activity</h3>
            </div>
          </div>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-2 rounded hover:bg-zinc-900/50 transition-colors">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      <Link href={`/applications/${activity.applicationId}`} className="font-medium hover:underline">
                        {activity.applicationName}
                      </Link>
                      {' '}{activity.message}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-500">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineStatusWidget />
        <TasksWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RealtimeMetrics />
        <ClerkAuthMetrics />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SystemHealth />
        <CostOverview />
        <RevenueMetrics />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Applications</h2>
          <Link href="/applications">
            <Button variant="ghost" size="sm">
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        <AppServicesGrid />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomerMetrics />
        <UsageAnalytics />
      </div>

      <DatabaseStatus />

      <RecentDeployments />
    </div>
  )
}
