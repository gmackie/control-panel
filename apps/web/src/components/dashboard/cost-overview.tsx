'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, PieChart } from 'lucide-react'

interface CostData {
  provider: string
  service: string
  category: string
  amount: number
  trend: 'up' | 'down' | 'stable'
  percentChange: number
}

interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  status: 'under' | 'warning' | 'over'
}

interface CostResponse {
  success: boolean
  legacy: {
    costs: CostData[]
    budgets: Budget[]
    summary: {
      totalCost: number
      costByProvider: Record<string, number>
      period: string
    }
  }
}

async function fetchCosts(): Promise<CostResponse> {
  const response = await fetch('/api/costs?period=monthly')
  if (!response.ok) {
    throw new Error('Failed to fetch costs')
  }
  return response.json()
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function BudgetBar({ budget }: { budget: Budget }) {
  const percentage = Math.min((budget.spent / budget.amount) * 100, 100)
  const overBudget = budget.spent > budget.amount
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{budget.name}</span>
        <span className={overBudget ? 'text-red-400' : 'text-foreground'}>
          {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            budget.status === 'over' ? 'bg-red-500' :
            budget.status === 'warning' ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function ProviderBreakdown({ costByProvider }: { costByProvider: Record<string, number> }) {
  const sorted = Object.entries(costByProvider)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
  
  const total = Object.values(costByProvider).reduce((a, b) => a + b, 0)
  
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
  ]
  
  return (
    <div className="space-y-2">
      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
        {sorted.map(([provider, amount], i) => (
          <div
            key={provider}
            className={`${colors[i]} transition-all duration-500`}
            style={{ width: `${(amount / total) * 100}%` }}
            title={`${provider}: ${formatCurrency(amount)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {sorted.map(([provider, amount], i) => (
          <div key={provider} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${colors[i]}`} />
            <span className="text-muted-foreground">{provider}</span>
            <span className="text-foreground">{formatCurrency(amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CostOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['costs-overview'],
    queryFn: fetchCosts,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  })

  if (isLoading) {
    return (
      <div className="bg-card border rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="h-12 bg-muted rounded w-1/2 mb-6" />
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-5/6" />
        </div>
      </div>
    )
  }

  if (error || !data?.legacy) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="h-5 w-5" />
          <span>Unable to load cost data</span>
        </div>
      </div>
    )
  }

  const { costs, budgets, summary } = data.legacy
  
  // Calculate trends
  const trendingUp = costs.filter(c => c.trend === 'up')
  const trendingDown = costs.filter(c => c.trend === 'down')
  const warningBudgets = budgets.filter(b => b.status === 'warning' || b.status === 'over')

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          <h3 className="font-semibold">Cost Overview</h3>
        </div>
        <Link 
          href="/costs" 
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Total Spend */}
      <div className="mb-6">
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(summary.totalCost)}
        </div>
        <div className="text-sm text-muted-foreground">
          Monthly spend ({new Date().toLocaleDateString('en-US', { month: 'long' })})
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
            <TrendingDown className="h-4 w-4" />
            <span className="text-lg font-semibold">{trendingDown.length}</span>
          </div>
          <div className="text-xs text-muted-foreground">Decreasing</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-lg font-semibold">{trendingUp.length}</span>
          </div>
          <div className="text-xs text-muted-foreground">Increasing</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-lg font-semibold">{warningBudgets.length}</span>
          </div>
          <div className="text-xs text-muted-foreground">Alerts</div>
        </div>
      </div>

      {/* Provider Breakdown */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">By Provider</span>
        </div>
        <ProviderBreakdown costByProvider={summary.costByProvider} />
      </div>

      {/* Budget Status */}
      <div>
        <div className="text-sm font-medium mb-3">Budget Utilization</div>
        <div className="space-y-3">
          {budgets.slice(0, 3).map(budget => (
            <BudgetBar key={budget.id} budget={budget} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default CostOverview
