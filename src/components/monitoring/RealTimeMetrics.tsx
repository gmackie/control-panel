"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye,
  EyeOff,
  BarChart3,
  LineChart,
  Settings,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Database,
  Globe,
  Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  status: 'healthy' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
  lastUpdated: Date;
  source: string;
  history: MetricDataPoint[];
}

interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

interface RealTimeMetricsProps {
  metrics: SystemMetric[];
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export function RealTimeMetrics({ metrics, timeRange, onTimeRangeChange }: RealTimeMetricsProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['cpu', 'memory', 'network']));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Enhanced mock data with history
  const enhancedMetrics: SystemMetric[] = metrics.map(metric => ({
    ...metric,
    history: generateHistoricalData(metric.value, 20)
  }));

  function generateHistoricalData(currentValue: number, points: number): MetricDataPoint[] {
    const data: MetricDataPoint[] = [];
    const now = new Date();
    
    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 30000); // 30 second intervals
      const variation = (Math.random() - 0.5) * 20; // ±10 variation
      const value = Math.max(0, Math.min(100, currentValue + variation));
      data.push({ timestamp, value });
    }
    
    return data;
  }

  const getMetricIcon = (id: string) => {
    switch (id) {
      case 'cpu': return <Cpu className="h-5 w-5 text-blue-500" />;
      case 'memory': return <MemoryStick className="h-5 w-5 text-green-500" />;
      case 'disk': return <HardDrive className="h-5 w-5 text-purple-500" />;
      case 'network': return <Network className="h-5 w-5 text-orange-500" />;
      case 'response-time': return <Clock className="h-5 w-5 text-cyan-500" />;
      case 'error-rate': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getProgressColor = (value: number, threshold: { warning: number; critical: number }) => {
    if (value >= threshold.critical) return 'bg-red-500';
    if (value >= threshold.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const toggleMetricSelection = (metricId: string) => {
    const newSelected = new Set(selectedMetrics);
    if (newSelected.has(metricId)) {
      newSelected.delete(metricId);
    } else {
      newSelected.add(metricId);
    }
    setSelectedMetrics(newSelected);
  };

  const MiniChart = ({ data }: { data: MetricDataPoint[] }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;
    
    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((point.value - minValue) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="h-16 w-full relative">
        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points={points}
            className="text-blue-400"
          />
          <defs>
            <linearGradient id={`gradient-${Math.random()}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <polygon
            fill={`url(#gradient-${Math.random()})`}
            points={`0,100 ${points} 100,100`}
            className="text-blue-400"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          Real-Time System Metrics
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <LineChart className="h-4 w-4" />
            </Button>
          </div>
          
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value={10}>10s refresh</option>
            <option value={30}>30s refresh</option>
            <option value={60}>1m refresh</option>
            <option value={300}>5m refresh</option>
          </select>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
        </div>
      </div>

      {/* Metric Selection */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-400">Select metrics to display:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {enhancedMetrics.map(metric => (
            <Button
              key={metric.id}
              variant={selectedMetrics.has(metric.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMetricSelection(metric.id)}
              className="flex items-center gap-2"
            >
              {getMetricIcon(metric.id)}
              {metric.name}
              {selectedMetrics.has(metric.id) ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* Metrics Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enhancedMetrics
            .filter(metric => selectedMetrics.has(metric.id))
            .map(metric => (
              <Card key={metric.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getMetricIcon(metric.id)}
                    <div>
                      <h3 className="font-semibold">{metric.name}</h3>
                      <p className="text-xs text-gray-400">{metric.source}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(metric.status)}>
                    {metric.status}
                  </Badge>
                </div>

                <div className="space-y-4">
                  {/* Current Value */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className={`text-3xl font-bold ${getStatusColor(metric.status)}`}>
                        {metric.value}
                        <span className="text-lg text-gray-400 ml-1">{metric.unit}</span>
                      </p>
                      <div className={`flex items-center gap-1 text-sm ${
                        metric.change > 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {metric.change > 0 ? 
                          <TrendingUp className="h-4 w-4" /> : 
                          <TrendingDown className="h-4 w-4" />
                        }
                        {Math.abs(metric.change)} from last hour
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Usage</span>
                      <span>{((metric.value / metric.threshold.critical) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={(metric.value / metric.threshold.critical) * 100} 
                        className="h-2"
                      />
                      {/* Warning and Critical Thresholds */}
                      <div className="absolute inset-0 flex">
                        <div 
                          className="border-r border-yellow-500 h-2"
                          style={{ width: `${(metric.threshold.warning / metric.threshold.critical) * 100}%` }}
                        />
                        <div 
                          className="border-r border-red-500 h-2"
                          style={{ width: `${((metric.threshold.critical - metric.threshold.warning) / metric.threshold.critical) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0</span>
                      <span className="text-yellow-500">{metric.threshold.warning}</span>
                      <span className="text-red-500">{metric.threshold.critical}</span>
                    </div>
                  </div>

                  {/* Mini Chart */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Last 10 minutes</span>
                      <span className="text-gray-500">
                        Updated {formatDistanceToNow(metric.lastUpdated, { addSuffix: true })}
                      </span>
                    </div>
                    <MiniChart data={metric.history} />
                  </div>
                </div>
              </Card>
            ))
          }
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {enhancedMetrics
            .filter(metric => selectedMetrics.has(metric.id))
            .map(metric => (
              <Card key={metric.id} className="p-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 flex-1">
                    {getMetricIcon(metric.id)}
                    <div>
                      <h3 className="font-semibold">{metric.name}</h3>
                      <p className="text-sm text-gray-400">{metric.source}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-xl font-bold ${getStatusColor(metric.status)}`}>
                        {metric.value}{metric.unit}
                      </p>
                      <div className={`flex items-center gap-1 text-xs ${
                        metric.change > 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {metric.change > 0 ? 
                          <TrendingUp className="h-3 w-3" /> : 
                          <TrendingDown className="h-3 w-3" />
                        }
                        {Math.abs(metric.change)}
                      </div>
                    </div>

                    <div className="w-32">
                      <Progress 
                        value={(metric.value / metric.threshold.critical) * 100} 
                        className="h-3"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0</span>
                        <span>{metric.threshold.critical}</span>
                      </div>
                    </div>

                    <Badge variant="outline" className={getStatusColor(metric.status)}>
                      {metric.status}
                    </Badge>

                    <div className="w-24 h-12">
                      <MiniChart data={metric.history} />
                    </div>

                    <div className="text-xs text-gray-500 text-right">
                      <p>{formatDistanceToNow(metric.lastUpdated, { addSuffix: true })}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          }
        </div>
      )}

      {selectedMetrics.size === 0 && (
        <Card className="p-8 text-center">
          <Activity className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Metrics Selected</h3>
          <p className="text-gray-500 mb-4">
            Select metrics from the filter above to start monitoring your system performance.
          </p>
        </Card>
      )}

      {/* System Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="h-5 w-5 text-blue-500" />
          System Summary
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-400">
              {enhancedMetrics.filter(m => m.status === 'healthy').length}
            </p>
            <p className="text-sm text-gray-400">Healthy Metrics</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {enhancedMetrics.filter(m => m.status === 'warning').length}
            </p>
            <p className="text-sm text-gray-400">Warning Metrics</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-400">
              {enhancedMetrics.filter(m => m.status === 'critical').length}
            </p>
            <p className="text-sm text-gray-400">Critical Metrics</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Activity className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {enhancedMetrics.length}
            </p>
            <p className="text-sm text-gray-400">Total Metrics</p>
          </div>
        </div>
      </Card>
    </div>
  );
}