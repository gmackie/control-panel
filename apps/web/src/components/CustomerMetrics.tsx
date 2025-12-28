"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTopCustomers } from "@/lib/api";
import { Users, TrendingUp, TrendingDown, UserPlus } from "lucide-react";

export default function CustomerMetrics() {
  const { data: customers, isLoading } = useQuery({
    queryKey: ["top-customers"],
    queryFn: fetchTopCustomers,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Customer Metrics</h3>
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const totalCustomers = customers?.length || 0;
  const activeCustomers =
    customers?.filter((c) => c.subscription?.status === "active").length || 0;
  const newCustomers =
    customers?.filter((c) => {
      const createdAt = new Date(c.createdAt);
      const now = new Date();
      const daysDiff =
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }).length || 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Customer Metrics</h3>
        <Users className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalCustomers}</p>
            <p className="text-sm text-muted-foreground">Total Customers</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{activeCustomers}</p>
            <p className="text-sm text-muted-foreground">
              Active Subscriptions
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <UserPlus className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-lg font-bold">{newCustomers}</p>
            <p className="text-sm text-muted-foreground">New This Month</p>
          </div>
        </div>
      </div>
    </div>
  );
}
