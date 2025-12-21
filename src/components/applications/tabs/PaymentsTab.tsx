"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { PaymentMetrics } from "@/types/unified-app";

export function PaymentsTab() {
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: PaymentMetrics | null }>({
    queryKey: ["app-payments"],
    queryFn: async () => {
      const response = await fetch("/api/apps/metrics/payments");
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
  });

  const metrics = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-red-400">Failed to load payment metrics</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-6 text-center">
        <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Stripe integration not configured</p>
        <p className="text-sm text-gray-500 mt-2">
          Configure Stripe to see payment metrics
        </p>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payment Metrics (Stripe)</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Revenue stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">MRR</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(metrics.mrr)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">ARR</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics.arr)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Revenue (30d)</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics.revenue30d)}</p>
            </div>
            <CreditCard className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Churn Rate</p>
              <p className="text-2xl font-bold text-yellow-400">
                {typeof metrics.churnRate === 'number' 
                  ? `${metrics.churnRate.toFixed(1)}%`
                  : metrics.churnRate}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Customer stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Customer Overview
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Total Customers</p>
              <p className="text-xl font-bold">{metrics.totalCustomers.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Subscriptions</p>
              <p className="text-xl font-bold text-green-400">
                {metrics.activeSubscriptions.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-500" />
            Payment Activity (24h)
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-400">Successful</p>
                <p className="text-xl font-bold text-green-400">
                  {Math.round(metrics.successfulPayments24h)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-400">Failed</p>
                <p className="text-xl font-bold text-red-400">
                  {Math.round(metrics.failedPayments24h)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
