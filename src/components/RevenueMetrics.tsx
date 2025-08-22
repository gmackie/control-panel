'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchStripeMetrics } from '@/lib/api'
import { TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react'

export default function RevenueMetrics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['stripe-metrics'],
    queryFn: fetchStripeMetrics,
    refetchInterval: 300000, // 5 minutes
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-700 rounded w-32"></div>
          </div>
        ))}
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  const mrrGrowth = calculateGrowth(metrics?.mrr || 0, (metrics?.mrr || 0) * 0.9) // Mock previous MRR

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* MRR */}
      <div className="card bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Monthly Recurring Revenue</span>
          <DollarSign className="h-5 w-5 text-green-500" />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-green-400">
            {formatCurrency(metrics?.mrr || 0)}
          </p>
          <div className="flex items-center text-xs">
            {mrrGrowth >= 0 ? (
              <>
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500">+{mrrGrowth.toFixed(1)}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                <span className="text-red-500">{mrrGrowth.toFixed(1)}%</span>
              </>
            )}
            <span className="text-gray-500 ml-1">vs last month</span>
          </div>
        </div>
      </div>

      {/* ARR */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Annual Run Rate</span>
          <DollarSign className="h-5 w-5 text-blue-500" />
        </div>
        <p className="text-2xl font-bold">{formatCurrency(metrics?.arr || 0)}</p>
      </div>

      {/* New Customers */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">New Customers</span>
          <Users className="h-5 w-5 text-purple-500" />
        </div>
        <p className="text-2xl font-bold">{metrics?.newCustomers || 0}</p>
        <p className="text-xs text-gray-500">This month</p>
      </div>

      {/* Revenue Today */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Revenue Today</span>
          <DollarSign className="h-5 w-5 text-yellow-500" />
        </div>
        <p className="text-2xl font-bold">
          {formatCurrency(metrics?.revenue.today || 0)}
        </p>
        <p className="text-xs text-gray-500">
          Month: {formatCurrency(metrics?.revenue.month || 0)}
        </p>
      </div>
    </div>
  )
}