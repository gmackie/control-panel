"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Receipt,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface StripeStats {
  availableBalance: number;
  pendingBalance: number;
  totalCustomers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  mrr: number;
  arr: number;
  revenue30d: number;
  revenue7d: number;
  successfulPayments30d: number;
  failedPayments30d: number;
  paymentSuccessRate: string;
  paidInvoices: number;
  openInvoices: number;
  overdueInvoices: number;
  totalFees30d: number;
  churnRate: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function StripeDashboard() {
  const [stats, setStats] = useState<StripeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/stripe?action=stats");
      if (!response.ok) {
        throw new Error("Failed to fetch Stripe stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Stripe data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            Make sure STRIPE_SECRET_KEY is configured in your environment variables.
          </p>
          <Button onClick={fetchStats} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-500" />
            Stripe Payments
          </h2>
          <p className="text-sm text-gray-400">Payment processing and subscriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Dashboard
            </Button>
          </a>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.availableBalance)}</p>
              <p className="text-sm text-gray-400">Available</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.pendingBalance)}</p>
              <p className="text-sm text-gray-400">Pending</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.mrr)}</p>
              <p className="text-sm text-gray-400">MRR</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.arr)}</p>
              <p className="text-sm text-gray-400">ARR</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue & Customers */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Last 7 days</span>
              <span className="text-xl font-bold text-green-500">
                {formatCurrency(stats.revenue7d)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Last 30 days</span>
              <span className="text-xl font-bold text-green-500">
                {formatCurrency(stats.revenue30d)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Fees (30d)</span>
              <span className="text-lg font-medium text-gray-400">
                -{formatCurrency(stats.totalFees30d)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Customers & Payments</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Total Customers</span>
              </div>
              <span className="font-bold">{stats.totalCustomers}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-gray-400">Successful (30d)</span>
              </div>
              <span className="font-bold text-green-500">{stats.successfulPayments30d}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-gray-400">Failed (30d)</span>
              </div>
              <span className="font-bold text-red-500">{stats.failedPayments30d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Success Rate</span>
              <Badge variant={parseFloat(stats.paymentSuccessRate) >= 95 ? "success" : "warning"}>
                {stats.paymentSuccessRate}%
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Subscriptions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Subscriptions</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-900 rounded-lg">
            <p className="text-2xl font-bold">{stats.totalSubscriptions}</p>
            <p className="text-sm text-gray-400">Total</p>
          </div>
          <div className="text-center p-4 bg-gray-900 rounded-lg">
            <p className="text-2xl font-bold text-green-500">{stats.activeSubscriptions}</p>
            <p className="text-sm text-gray-400">Active</p>
          </div>
          <div className="text-center p-4 bg-gray-900 rounded-lg">
            <p className="text-2xl font-bold text-blue-500">{stats.trialingSubscriptions}</p>
            <p className="text-sm text-gray-400">Trialing</p>
          </div>
          <div className="text-center p-4 bg-gray-900 rounded-lg">
            <p className="text-2xl font-bold text-orange-500">{stats.pastDueSubscriptions}</p>
            <p className="text-sm text-gray-400">Past Due</p>
          </div>
          <div className="text-center p-4 bg-gray-900 rounded-lg">
            <p className="text-2xl font-bold text-red-500">{stats.canceledSubscriptions}</p>
            <p className="text-sm text-gray-400">Canceled</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-gray-400">Churn Rate</span>
          </div>
          <Badge variant={parseFloat(stats.churnRate) <= 5 ? "success" : "warning"}>
            {stats.churnRate}%
          </Badge>
        </div>
      </Card>

      {/* Invoices */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Invoices</h3>
          <a
            href="https://dashboard.stripe.com/invoices"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              View All
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </a>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg">
            <Receipt className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xl font-bold">{stats.paidInvoices}</p>
              <p className="text-sm text-gray-400">Paid</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg">
            <Receipt className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-xl font-bold">{stats.openInvoices}</p>
              <p className="text-sm text-gray-400">Open</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg">
            <Receipt className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-xl font-bold">{stats.overdueInvoices}</p>
              <p className="text-sm text-gray-400">Overdue</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
