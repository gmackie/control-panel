"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Server,
  HardDrive,
  Camera,
  Network,
  AlertTriangle,
  Calendar,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';

interface CostSummary {
  current: {
    hourly: number;
    daily: number;
    monthly: number;
    projected: number;
    currency: string;
    breakdown: {
      servers: any[];
      volumes: any[];
      snapshots: any[];
      loadBalancers: any[];
      floatingIps: any[];
      traffic: any;
    };
  };
  trends: {
    daily: { value: number; change: number };
    weekly: { value: number; change: number };
    monthly: { value: number; change: number };
  };
  topSpenders: Array<{ name: string; type: string; cost: number }>;
}

interface CostOptimization {
  type: string;
  resource: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function CostDashboard() {
  const [timeRange, setTimeRange] = useState(7); // days
  const [showOptimizations, setShowOptimizations] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cluster-costs', timeRange, showOptimizations],
    queryFn: async () => {
      const response = await fetch(
        `/api/cluster/costs?days=${timeRange}&optimizations=${showOptimizations}`
      );
      if (!response.ok) throw new Error('Failed to fetch cost data');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const summary = data?.summary as CostSummary;
  const history = data?.history || [];
  const optimizations = data?.optimizations || [];

  const formatCurrency = (value: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) {
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    } else if (change < 0) {
      return <ArrowDownRight className="h-4 w-4 text-green-500" />;
    }
    return null;
  };

  const getChangeColor = (change: number) => {
    if (change > 10) return 'text-red-500';
    if (change > 0) return 'text-yellow-500';
    if (change < 0) return 'text-green-500';
    return 'text-gray-400';
  };

  // Prepare data for charts
  const costTrendData = history.map((point: any) => ({
    time: new Date(point.timestamp).toLocaleDateString(),
    hourly: point.hourly,
    daily: point.daily,
    projected: point.projected,
  }));

  const breakdownData = summary?.current ? [
    { name: 'Servers', value: summary.current.breakdown.servers.reduce((sum, s) => sum + s.monthly, 0) },
    { name: 'Volumes', value: summary.current.breakdown.volumes.reduce((sum, v) => sum + v.monthly, 0) },
    { name: 'Snapshots', value: summary.current.breakdown.snapshots.reduce((sum, s) => sum + s.monthly, 0) },
    { name: 'Load Balancers', value: summary.current.breakdown.loadBalancers.reduce((sum, lb) => sum + lb.monthly, 0) },
    { name: 'Floating IPs', value: summary.current.breakdown.floatingIps.reduce((sum, ip) => sum + ip.monthly, 0) },
    { name: 'Traffic', value: summary.current.breakdown.traffic.totalCost },
  ].filter(item => item.value > 0) : [];

  const totalSavings = optimizations.reduce((sum: number, opt: CostOptimization) => sum + opt.savings, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load cost data. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cost Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Cost Overview</h2>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(days => (
              <Button
                key={days}
                variant={timeRange === days ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">Current Monthly</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.current?.monthly || 0)}
            </p>
            <div className={`flex items-center gap-1 text-sm ${getChangeColor(summary?.trends.monthly.change || 0)}`}>
              {getChangeIcon(summary?.trends.monthly.change || 0)}
              <span>{Math.abs(summary?.trends.monthly.change || 0).toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400">Projected Monthly</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.current?.projected || 0)}
            </p>
            <p className="text-sm text-gray-500">Based on current usage</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Daily Average</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.trends.daily.value || 0)}
            </p>
            <div className={`flex items-center gap-1 text-sm ${getChangeColor(summary?.trends.daily.change || 0)}`}>
              {getChangeIcon(summary?.trends.daily.change || 0)}
              <span>{Math.abs(summary?.trends.daily.change || 0).toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400">Hourly Rate</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.current?.hourly || 0)}
            </p>
            <p className="text-sm text-gray-500">Current run rate</p>
          </div>
        </div>
      </Card>

      {/* Cost Trends Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          Cost Trends
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={costTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="daily" 
                stroke="#3B82F6" 
                name="Daily Cost"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="projected" 
                stroke="#F59E0B" 
                name="Projected Monthly"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Spenders */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top Spenders</h3>
          <div className="space-y-3">
            {summary?.topSpenders.map((spender, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="font-medium">{spender.name}</p>
                    <p className="text-sm text-gray-400">{spender.type}</p>
                  </div>
                </div>
                <span className="font-medium">
                  {formatCurrency(spender.cost)}/mo
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Optimization Recommendations */}
      {showOptimizations && optimizations.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-green-500" />
              Optimization Opportunities
            </h3>
            <Badge variant="success">
              Potential Savings: {formatCurrency(totalSavings)}/mo
            </Badge>
          </div>
          <div className="space-y-3">
            {optimizations.map((opt: CostOptimization, index: number) => (
              <Alert key={index}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{opt.resource}</span>
                    <Badge variant={
                      opt.impact === 'high' ? 'error' : 
                      opt.impact === 'medium' ? 'warning' : 
                      'secondary'
                    }>
                      {opt.impact} impact
                    </Badge>
                  </div>
                  <p className="text-sm">{opt.recommendation}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">
                      Current: {formatCurrency(opt.currentCost)}/mo
                    </span>
                    <span className="text-green-500 font-medium">
                      Save {formatCurrency(opt.savings)}/mo
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </Card>
      )}

      {/* Resource Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Resource Details</h3>
        <div className="space-y-4">
          {/* Servers */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Servers ({summary?.current?.breakdown.servers.length || 0})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Location</th>
                    <th className="text-right py-2">Runtime</th>
                    <th className="text-right py-2">Cost/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.current?.breakdown.servers.map((server: any) => (
                    <tr key={server.id} className="border-b border-gray-800">
                      <td className="py-2">{server.name}</td>
                      <td className="py-2">{server.type}</td>
                      <td className="py-2">{server.location}</td>
                      <td className="py-2 text-right">
                        {Math.floor(server.runtime / 24)}d {Math.floor(server.runtime % 24)}h
                      </td>
                      <td className="py-2 text-right">{formatCurrency(server.monthly)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Volumes */}
          {summary?.current?.breakdown.volumes.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Volumes ({summary.current.breakdown.volumes.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {summary.current.breakdown.volumes.map((volume: any) => (
                  <div key={volume.id} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                    <div>
                      <p className="font-medium">{volume.name}</p>
                      <p className="text-sm text-gray-400">{volume.size}GB - {volume.location}</p>
                    </div>
                    <span className="text-sm">{formatCurrency(volume.monthly)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}