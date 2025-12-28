"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  UserPlus,
  Shield,
  Key,
  Loader2,
  RefreshCw,
  Building,
  Activity,
} from "lucide-react";
import { AuthMetrics } from "@/types/unified-app";

export function UsersTab() {
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: AuthMetrics | null }>({
    queryKey: ["app-auth"],
    queryFn: async () => {
      const response = await fetch("/api/apps/metrics/auth");
      if (!response.ok) throw new Error("Failed to fetch auth metrics");
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
        <p className="text-red-400">Failed to load auth metrics</p>
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
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Clerk integration not configured</p>
        <p className="text-sm text-gray-500 mt-2">
          Configure Clerk to see authentication metrics
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">User & Auth Metrics (Clerk)</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Users</p>
              <p className="text-2xl font-bold">{metrics.totalUsers.toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active (24h)</p>
              <p className="text-2xl font-bold text-green-400">{metrics.activeUsers24h.toLocaleString()}</p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">New Users (24h)</p>
              <p className="text-2xl font-bold text-purple-400">{metrics.newUsers24h.toLocaleString()}</p>
            </div>
            <UserPlus className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Sessions</p>
              <p className="text-2xl font-bold">{metrics.activeSessions.toLocaleString()}</p>
            </div>
            <Key className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* More stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            MFA Adoption
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Users with MFA</p>
              <p className="text-xl font-bold">{metrics.mfaEnabled.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Adoption Rate</p>
              <p className="text-xl font-bold text-green-400">
                {typeof metrics.mfaAdoptionRate === 'number' 
                  ? `${metrics.mfaAdoptionRate.toFixed(1)}%`
                  : metrics.mfaAdoptionRate}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-500" />
            Organizations
          </h4>
          <div>
            <p className="text-sm text-gray-400">Total Organizations</p>
            <p className="text-xl font-bold">{metrics.organizations?.toLocaleString() || 0}</p>
          </div>
        </Card>
      </div>

      {/* Auth methods */}
      {metrics.authMethods && (
        <Card className="p-4">
          <h4 className="font-medium mb-4">Authentication Methods</h4>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-400">Password</p>
              <p className="text-xl font-bold">{metrics.authMethods.password?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Google</p>
              <p className="text-xl font-bold">{metrics.authMethods.google?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">GitHub</p>
              <p className="text-xl font-bold">{metrics.authMethods.github?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Other SSO</p>
              <p className="text-xl font-bold">{metrics.authMethods.other?.toLocaleString() || 0}</p>
            </div>
          </div>
        </Card>
      )}

      {/* 7-day stats */}
      <Card className="p-4">
        <h4 className="font-medium mb-4">7-Day Activity</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Active Users (7d)</p>
            <p className="text-xl font-bold">{metrics.activeUsers7d?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">New Users (7d)</p>
            <p className="text-xl font-bold">{metrics.newUsers7d?.toLocaleString() || 0}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
