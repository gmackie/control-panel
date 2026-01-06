"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Code,
  Smartphone,
  Server,
  ChevronLeft,
  Activity,
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Globe,
  Database,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";

interface Application {
  id: string;
  name: string;
  slug: string;
  appType: string;
  platform: string | null;
  status: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  status: string;
  applications: Application[];
  applicationCount: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: string;
}

function MetricCard({ title, value, change, changeLabel, icon, color }: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
              {isNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
              <span className={`text-sm ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-400'}`}>
                {isPositive ? '+' : ''}{change}% {changeLabel}
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

const APP_TYPE_ICONS: Record<string, React.ReactNode> = {
  web: <Code className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  api: <Server className="h-4 w-4" />,
  worker: <Server className="h-4 w-4" />,
};

export default function ProductDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      return response.json();
    },
  });

  const getColorClass = (color: string | null) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500/20 text-blue-400",
      green: "bg-green-500/20 text-green-400",
      purple: "bg-purple-500/20 text-purple-400",
      orange: "bg-orange-500/20 text-orange-400",
      pink: "bg-pink-500/20 text-pink-400",
      cyan: "bg-cyan-500/20 text-cyan-400",
      yellow: "bg-yellow-500/20 text-yellow-400",
      red: "bg-red-500/20 text-red-400",
    };
    return colorMap[color || "blue"] || colorMap.blue;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-800 rounded"></div>
            ))}
          </div>
          <div className="h-80 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Card className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Product not found</h3>
          <Link href="/products">
            <Button variant="outline">Back to Products</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const activeApps = product.applications.filter(app => app.status === 'active').length;
  const webApps = product.applications.filter(app => app.appType === 'web').length;
  const mobileApps = product.applications.filter(app => app.appType === 'mobile').length;
  const apiApps = product.applications.filter(app => app.appType === 'api').length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/products/${id}`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Product
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${getColorClass(product.color)}`}>
          <Package className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{product.name} Dashboard</h1>
          <p className="text-gray-400">Combined metrics across all applications</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value="1.2M"
          change={12.5}
          changeLabel="vs last week"
          icon={<Activity className="h-6 w-6" />}
          color="bg-blue-500/20 text-blue-400"
        />
        <MetricCard
          title="Active Users"
          value="8,432"
          change={5.2}
          changeLabel="vs last week"
          icon={<Users className="h-6 w-6" />}
          color="bg-green-500/20 text-green-400"
        />
        <MetricCard
          title="Monthly Cost"
          value="$1,247"
          change={-3.1}
          changeLabel="vs last month"
          icon={<DollarSign className="h-6 w-6" />}
          color="bg-purple-500/20 text-purple-400"
        />
        <MetricCard
          title="Avg Response Time"
          value="142ms"
          change={-8.3}
          changeLabel="improvement"
          icon={<Zap className="h-6 w-6" />}
          color="bg-orange-500/20 text-orange-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Application Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <p className="text-3xl font-bold text-blue-400">{product.applicationCount}</p>
              <p className="text-sm text-gray-400">Total Apps</p>
            </div>
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <p className="text-3xl font-bold text-green-400">{activeApps}</p>
              <p className="text-sm text-gray-400">Active</p>
            </div>
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <p className="text-3xl font-bold text-purple-400">{webApps + apiApps}</p>
              <p className="text-sm text-gray-400">Web/API</p>
            </div>
            <div className="text-center p-4 bg-gray-800/50 rounded-lg">
              <p className="text-3xl font-bold text-orange-400">{mobileApps}</p>
              <p className="text-sm text-gray-400">Mobile</p>
            </div>
          </div>

          <div className="space-y-3">
            {product.applications.map((app) => (
              <Link
                key={app.id}
                href={`/applications/${app.id}/dashboard`}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-700 rounded">
                    {APP_TYPE_ICONS[app.appType] || <Code className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium">{app.name}</p>
                    <p className="text-xs text-gray-500">{app.appType} {app.platform && `(${app.platform})`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">--</p>
                    <p className="text-xs text-gray-500">req/min</p>
                  </div>
                  <Badge variant={app.status === 'active' ? 'default' : 'secondary'}>
                    {app.status}
                  </Badge>
                </div>
              </Link>
            ))}
            {product.applications.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No applications in this product yet
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Health Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">Web Services</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">API Gateway</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">Database</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Healthy</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-green-500/20 rounded">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                </div>
                <div>
                  <p className="text-sm">Deployment successful</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-blue-500/20 rounded">
                  <Activity className="h-3 w-3 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm">Traffic spike detected</p>
                  <p className="text-xs text-gray-500">5 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-yellow-500/20 rounded">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm">High latency warning</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Cost Breakdown</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Compute</span>
                <span className="text-sm font-medium">$845</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '68%' }}></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Database</span>
                <span className="text-sm font-medium">$248</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '20%' }}></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Storage</span>
                <span className="text-sm font-medium">$154</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '12%' }}></div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
