'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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
import { fetchBusinessMetrics } from '@/lib/api'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const { data: metrics } = useQuery({
    queryKey: ['business-metrics'],
    queryFn: fetchBusinessMetrics,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your infrastructure and applications</p>
      </div>

      <DashboardStats />

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
        <h2 className="text-xl font-semibold mb-4">Applications</h2>
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
