'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import InfrastructureOverview from '@/components/dashboard/infrastructure-overview'
import MonitoringDashboard from '@/components/dashboard/monitoring-dashboard'
import ClusterManagement from '@/components/cluster/cluster-management'
import IntegrationsDashboard from '@/components/integrations/integrations-dashboard'
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
            className="inline-flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
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
        <h1 className="text-3xl font-bold mb-2">GMAC.IO Control Panel</h1>
        <p className="text-muted-foreground">Complete infrastructure management and monitoring platform</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="cluster">Cluster</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="infrastructure">
          <InfrastructureOverview />
        </TabsContent>

        <TabsContent value="monitoring">
          <MonitoringDashboard />
        </TabsContent>

        <TabsContent value="cluster">
          <ClusterManagement />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}