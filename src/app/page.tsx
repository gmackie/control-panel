'use client'

import { useQuery } from '@tanstack/react-query'
import RevenueMetrics from '@/components/RevenueMetrics'
import AppServicesGrid from '@/components/AppServicesGrid'
import CustomerMetrics from '@/components/CustomerMetrics'
import DatabaseStatus from '@/components/DatabaseStatus'
import RecentDeployments from '@/components/RecentDeployments'
import UsageAnalytics from '@/components/UsageAnalytics'
import { fetchBusinessMetrics } from '@/lib/api'

export default function Dashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['business-metrics'],
    queryFn: fetchBusinessMetrics,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Business Control Panel</h1>
        <p className="text-muted">Monitor your applications, customers, and revenue</p>
      </div>

      {/* Revenue Overview */}
      <RevenueMetrics />

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
  )
}