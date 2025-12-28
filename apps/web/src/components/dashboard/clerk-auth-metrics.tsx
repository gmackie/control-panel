"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  UserPlus,
  LogIn,
  Shield,
  Building,
  Activity,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { ClerkMetrics } from "@/types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export function ClerkAuthMetrics() {
  const { data: metrics, isLoading } = useQuery<ClerkMetrics>({
    queryKey: ["clerk-metrics"],
    queryFn: async () => {
      const response = await fetch("/api/clerk/metrics");
      if (!response.ok) throw new Error("Failed to fetch Clerk metrics");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading || !metrics) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  const authMethodsData = [
    { name: "Email", value: metrics.authentication.methods.email, color: "#3b82f6" },
    { name: "Google", value: metrics.authentication.methods.google, color: "#ea4335" },
    { name: "GitHub", value: metrics.authentication.methods.github, color: "#24292e" },
    { name: "Microsoft", value: metrics.authentication.methods.microsoft, color: "#0078d4" },
  ];

  const successRate = 
    ((metrics.authentication.signIns + metrics.authentication.signUps) /
    (metrics.authentication.signIns + metrics.authentication.signUps + metrics.authentication.failures)) * 100;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Authentication Metrics</h2>
        <Badge variant="outline" className="text-xs">
          Clerk Auth
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Stats */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Total Users */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Users</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{metrics.totalUsers.toLocaleString()}</span>
                <Badge variant="success" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {((metrics.activeUsers / metrics.totalUsers) * 100).toFixed(0)}% active
                </Badge>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Sessions</span>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{metrics.sessions.active}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Avg: {Math.floor(metrics.sessions.avgDuration / 60)}m
              </span>
            </div>
          </div>

          {/* New Users */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">New Users</span>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded p-2">
                <div className="font-semibold">{metrics.newUsers.today}</div>
                <div className="text-xs text-muted-foreground">Today</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="font-semibold">{metrics.newUsers.week}</div>
                <div className="text-xs text-muted-foreground">This Week</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="font-semibold">{metrics.newUsers.month}</div>
                <div className="text-xs text-muted-foreground">This Month</div>
              </div>
            </div>
          </div>

          {/* Organizations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Organizations</span>
              <Building className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{metrics.organizations.total}</span>
              <span className="text-sm text-muted-foreground">
                {metrics.organizations.members} total members
              </span>
            </div>
            <Progress 
              value={(metrics.organizations.active / metrics.organizations.total) * 100} 
              className="h-2"
            />
          </div>

          {/* MFA Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Multi-Factor Auth</span>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{metrics.mfa.enabled} users</span>
              <Badge variant={metrics.mfa.usage > 0.2 ? "success" : "warning"}>
                {(metrics.mfa.usage * 100).toFixed(1)}% adoption
              </Badge>
            </div>
            <Progress value={metrics.mfa.usage * 100} className="h-2" />
          </div>
        </div>

        {/* Authentication Methods & Success Rate */}
        <div className="space-y-4">
          {/* Auth Methods Chart */}
          <div>
            <h3 className="text-sm font-medium mb-3">Authentication Methods</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={authMethodsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {authMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {authMethodsData.map((method) => (
                <div key={method.name} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: method.color }}
                  />
                  <span className="text-muted-foreground">{method.name}</span>
                  <span className="font-medium">{method.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Authentication Success Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Authentication Success Rate</span>
              <LogIn className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{successRate.toFixed(1)}%</span>
              {metrics.authentication.failures > 0 && (
                <Badge variant="warning" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {metrics.authentication.failures} failures
                </Badge>
              )}
            </div>
            <Progress value={successRate} className="h-2" />
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>Sign-ins: {metrics.authentication.signIns.toLocaleString()}</div>
              <div>Sign-ups: {metrics.authentication.signUps.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}