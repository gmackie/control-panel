"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Shield,
  Key,
  UserCheck,
  Building2,
  ExternalLink,
  RefreshCw,
  Ban,
  CheckCircle,
} from "lucide-react";

interface ClerkStats {
  totalUsers: number;
  activeSessions: number;
  organizations: number;
  newUsersLast24h: number;
  newUsersLast7d: number;
  newUsersLast30d: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
  passwordUsers: number;
  socialUsers: number;
  mfaUsers: number;
  mfaAdoptionRate: string | number;
  providerBreakdown: Record<string, number>;
}

interface ClerkUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: Array<{ email_address: string }>;
  image_url: string;
  created_at: number;
  last_sign_in_at: number | null;
  banned: boolean;
  two_factor_enabled: boolean;
}

export function ClerkDashboard() {
  const [stats, setStats] = useState<ClerkStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<ClerkUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch("/api/integrations/clerk?action=stats"),
        fetch("/api/integrations/clerk?action=users&limit=10"),
      ]);

      if (!statsRes.ok || !usersRes.ok) {
        throw new Error("Failed to fetch Clerk data");
      }

      const [statsData, usersData] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
      ]);

      setStats(statsData);
      setRecentUsers(usersData.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Clerk data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBanUser = async (userId: string, currentlyBanned: boolean) => {
    setActionLoading(userId);
    try {
      const response = await fetch("/api/integrations/clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentlyBanned ? "unban-user" : "ban-user",
          userId,
        }),
      });
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to update user:", err);
    } finally {
      setActionLoading(null);
    }
  };

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
            Make sure CLERK_SECRET_KEY is configured in your environment variables.
          </p>
          <Button onClick={fetchData} variant="outline">
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
            <Shield className="h-5 w-5 text-purple-500" />
            Clerk Authentication
          </h2>
          <p className="text-sm text-gray-400">User management and authentication</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <a
            href="https://dashboard.clerk.com"
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

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Total Users</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <UserCheck className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeSessions}</p>
              <p className="text-sm text-gray-400">Active Sessions</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.organizations}</p>
              <p className="text-sm text-gray-400">Organizations</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Key className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.mfaAdoptionRate}%</p>
              <p className="text-sm text-gray-400">MFA Adoption</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Growth Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">User Growth</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">+{stats.newUsersLast24h}</p>
            <p className="text-sm text-gray-400">Last 24h</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">+{stats.newUsersLast7d}</p>
            <p className="text-sm text-gray-400">Last 7d</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">+{stats.newUsersLast30d}</p>
            <p className="text-sm text-gray-400">Last 30d</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.activeUsersLast24h}</p>
            <p className="text-sm text-gray-400">Active 24h</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.activeUsersLast7d}</p>
            <p className="text-sm text-gray-400">Active 7d</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.mfaUsers}</p>
            <p className="text-sm text-gray-400">MFA Enabled</p>
          </div>
        </div>
      </Card>

      {/* Auth Methods & Providers */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Auth Methods</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Password</span>
              <span className="font-medium">{stats.passwordUsers} users</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Social Login</span>
              <span className="font-medium">{stats.socialUsers} users</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">MFA Enabled</span>
              <span className="font-medium">{stats.mfaUsers} users</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">OAuth Providers</h3>
          <div className="space-y-3">
            {Object.entries(stats.providerBreakdown).length === 0 ? (
              <p className="text-gray-400">No OAuth providers configured</p>
            ) : (
              Object.entries(stats.providerBreakdown).map(([provider, count]) => (
                <div key={provider} className="flex items-center justify-between">
                  <span className="text-gray-400 capitalize">{provider}</span>
                  <span className="font-medium">{count} users</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent Users */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Users</h3>
          <a
            href="https://dashboard.clerk.com/users"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              View All
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </a>
        </div>

        {recentUsers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No users found</p>
        ) : (
          <div className="space-y-3">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={user.image_url}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {user.first_name} {user.last_name}
                      </p>
                      {user.banned && (
                        <Badge variant="error" className="text-xs">Banned</Badge>
                      )}
                      {user.two_factor_enabled && (
                        <Badge variant="outline" className="text-xs">MFA</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {user.email_addresses[0]?.email_address}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBanUser(user.id, user.banned)}
                    disabled={actionLoading === user.id}
                  >
                    {user.banned ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Ban className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
