'use client'

import { useAuth } from '@/app/providers'
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
import UnauthenticatedHomePage from './page-unauthenticated'

export default function Dashboard() {
  const { authenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const { data: metrics } = useQuery({
    queryKey: ['business-metrics'],
    queryFn: fetchBusinessMetrics,
    enabled: authenticated,
  })

  useEffect(() => {
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return <UnauthenticatedHomePage />
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