'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import RevenueMetrics from '@/components/RevenueMetrics'
import AppServicesGrid from '@/components/AppServicesGrid'
import CustomerMetrics from '@/components/CustomerMetrics'
import DatabaseStatus from '@/components/DatabaseStatus'
import RecentDeployments from '@/components/RecentDeployments'
import UsageAnalytics from '@/components/UsageAnalytics'
import { SystemHealth } from '@/components/dashboard/system-health'
import { RealtimeMetrics } from '@/components/dashboard/realtime-metrics'
import { ClerkAuthMetrics } from '@/components/dashboard/clerk-auth-metrics'
import { fetchBusinessMetrics } from '@/lib/api'
import UnauthenticatedHomePage from './page-unauthenticated'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const { data: metrics } = useQuery({
    queryKey: ['business-metrics'],
    queryFn: fetchBusinessMetrics,
    enabled: !!session,
  })

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <UnauthenticatedHomePage />
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Business Control Panel</h1>
          <p className="text-muted">Monitor your applications, customers, and revenue</p>
        </div>

      {/* Real-time Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RealtimeMetrics />
        <ClerkAuthMetrics />
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <SystemHealth />
        </div>
        <div className="lg:col-span-2">
          <RevenueMetrics />
        </div>
      </div>

      {/* Application Services */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Application Services</h2>
        <AppServicesGrid />
      </div>

      {/* Customer & Usage Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomerMetrics />
        <UsageAnalytics />
      </div>

      {/* Database Status */}
      <DatabaseStatus />

      {/* Recent Deployments */}
      <RecentDeployments />
      </div>
    </div>
  )
}