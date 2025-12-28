"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Clock,
  AlertTriangle
} from "lucide-react";

interface ServiceMetricsChartProps {
  service: {
    id: string;
    name: string;
    status: 'healthy' | 'degraded' | 'down' | 'maintenance';
    metrics: {
      availability: number;
      responseTime: {
        p50: number;
        p95: number;
        p99: number;
      };
      throughput: number;
      errorRate: number;
      lastDay: {
        requests: number;
        errors: number;
        availability: number;
      };
    };
  };
  timeRange: '1h' | '24h' | '7d' | '30d';
}

export function ServiceMetricsChart({ service, timeRange }: ServiceMetricsChartProps) {
  // Mock data for different time ranges
  const generateMockData = (range: string) => {
    const points = range === '1h' ? 60 : range === '24h' ? 24 : range === '7d' ? 7 : 30;
    return Array.from({ length: points }, (_, i) => ({
      time: i,
      responseTime: 100 + Math.random() * 200,
      errorRate: Math.random() * 5,
      throughput: 50 + Math.random() * 100,
    }));
  };

  const data = generateMockData(timeRange);
  const maxResponseTime = Math.max(...data.map(d => d.responseTime));
  const maxErrorRate = Math.max(...data.map(d => d.errorRate));
  const maxThroughput = Math.max(...data.map(d => d.throughput));

  // Calculate trends
  const currentResponseTime = data[data.length - 1]?.responseTime || 0;
  const previousResponseTime = data[data.length - 2]?.responseTime || 0;
  const responseTimeTrend = currentResponseTime > previousResponseTime ? 'up' : 'down';

  const currentErrorRate = data[data.length - 1]?.errorRate || 0;
  const previousErrorRate = data[data.length - 2]?.errorRate || 0;
  const errorRateTrend = currentErrorRate > previousErrorRate ? 'up' : 'down';

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">{service.name}</h3>
          <p className="text-sm text-gray-400">Last {timeRange}</p>
        </div>
        <Badge 
          variant="secondary" 
          className={`capitalize ${
            service.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
            service.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
            service.status === 'down' ? 'bg-red-500/20 text-red-400' :
            'bg-blue-500/20 text-blue-400'
          }`}
        >
          {service.status}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-gray-400">Response Time</span>
            {responseTimeTrend === 'up' ? (
              <TrendingUp className="h-3 w-3 text-red-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-500" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>P50</span>
              <span className="font-medium">{service.metrics.responseTime.p50}ms</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>P95</span>
              <span className="font-medium">{service.metrics.responseTime.p95}ms</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>P99</span>
              <span className="font-medium">{service.metrics.responseTime.p99}ms</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-gray-400">Error Rate</span>
            {errorRateTrend === 'up' ? (
              <TrendingUp className="h-3 w-3 text-red-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-500" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Current</span>
              <span className="font-medium">{service.metrics.errorRate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>24h Total</span>
              <span className="font-medium">{service.metrics.lastDay.errors}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Charts */}
      <div className="space-y-3">
        {/* Response Time Chart */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Response Time</span>
            <span>{maxResponseTime.toFixed(0)}ms</span>
          </div>
          <div className="h-8 flex items-end gap-px">
            {data.map((point, index) => (
              <div
                key={index}
                className="bg-blue-500/60 flex-1 min-w-px rounded-t-sm"
                style={{
                  height: `${(point.responseTime / maxResponseTime) * 100}%`,
                }}
                title={`${point.responseTime.toFixed(0)}ms`}
              />
            ))}
          </div>
        </div>

        {/* Error Rate Chart */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Error Rate</span>
            <span>{maxErrorRate.toFixed(1)}%</span>
          </div>
          <div className="h-6 flex items-end gap-px">
            {data.map((point, index) => (
              <div
                key={index}
                className="bg-red-500/60 flex-1 min-w-px rounded-t-sm"
                style={{
                  height: `${Math.max((point.errorRate / maxErrorRate) * 100, 2)}%`,
                }}
                title={`${point.errorRate.toFixed(2)}%`}
              />
            ))}
          </div>
        </div>

        {/* Throughput Chart */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Throughput</span>
            <span>{maxThroughput.toFixed(0)} req/s</span>
          </div>
          <div className="h-6 flex items-end gap-px">
            {data.map((point, index) => (
              <div
                key={index}
                className="bg-green-500/60 flex-1 min-w-px rounded-t-sm"
                style={{
                  height: `${(point.throughput / maxThroughput) * 100}%`,
                }}
                title={`${point.throughput.toFixed(0)} req/s`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-800">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Activity className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-xs text-gray-400">Availability</p>
          <p className="text-sm font-semibold">{service.metrics.availability.toFixed(2)}%</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xs text-gray-400">Throughput</p>
          <p className="text-sm font-semibold">{service.metrics.throughput.toFixed(0)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xs text-gray-400">Requests</p>
          <p className="text-sm font-semibold">{service.metrics.lastDay.requests.toLocaleString()}</p>
        </div>
      </div>
    </Card>
  );
}