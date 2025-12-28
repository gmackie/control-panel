"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Clock,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Globe,
  Server,
  Database,
  Users,
  Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ServiceHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastCheck: Date;
  dependencies: string[];
  version: string;
  environment: string;
}

interface PerformanceMetric {
  timestamp: Date;
  responseTime: number;
  errorRate: number;
  throughput: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface PerformanceAnalyticsProps {
  services: ServiceHealth[];
  timeRange: string;
}

export function PerformanceAnalytics({ services, timeRange }: PerformanceAnalyticsProps) {
  const [selectedService, setSelectedService] = useState<string>('all');
  const [metricType, setMetricType] = useState<'response-time' | 'error-rate' | 'throughput' | 'uptime'>('response-time');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');

  // Generate mock performance data
  const generatePerformanceData = (serviceName: string, days: number = 7): PerformanceMetric[] => {
    const data: PerformanceMetric[] = [];
    const now = new Date();
    
    for (let i = days * 24; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      const baseResponseTime = serviceName === 'argocd' ? 400 : 150;
      const variation = (Math.random() - 0.5) * 100;
      
      data.push({
        timestamp,
        responseTime: Math.max(50, baseResponseTime + variation),
        errorRate: Math.random() * 2,
        throughput: Math.floor(Math.random() * 1000) + 500,
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100
      });
    }
    
    return data;
  };

  const performanceData = generatePerformanceData(selectedService, 7);

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getServiceStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const calculateTrend = (data: number[]) => {
    if (data.length < 2) return 0;
    const recent = data.slice(-24).reduce((a, b) => a + b, 0) / 24;
    const previous = data.slice(-48, -24).reduce((a, b) => a + b, 0) / 24;
    return ((recent - previous) / previous) * 100;
  };

  const PerformanceChart = ({ data, type }: { data: PerformanceMetric[], type: string }) => {
    const values = data.map(d => {
      switch (type) {
        case 'response-time': return d.responseTime;
        case 'error-rate': return d.errorRate;
        case 'throughput': return d.throughput;
        default: return d.responseTime;
      }
    });

    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const value = values[index];
      const y = 100 - ((value - minValue) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="h-64 w-full relative">
        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {chartType === 'area' && (
            <polygon
              fill="url(#chartGradient)"
              points={`0,100 ${points} 100,100`}
            />
          )}
          
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={points}
          />
          
          {/* Data points */}
          {data.map((_, index) => {
            const x = (index / (data.length - 1)) * 100;
            const value = values[index];
            const y = 100 - ((value - minValue) / range) * 100;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1.5"
                fill="#3b82f6"
                className="hover:r-3 transition-all cursor-pointer"
              />
            );
          })}
          
          {/* Grid lines */}
          {[25, 50, 75].map(y => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#374151"
              strokeWidth="0.5"
              opacity="0.3"
            />
          ))}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 -ml-12">
          <span>{maxValue.toFixed(0)}</span>
          <span>{((maxValue + minValue) / 2).toFixed(0)}</span>
          <span>{minValue.toFixed(0)}</span>
        </div>
        
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 mt-2">
          <span>7d ago</span>
          <span>3d ago</span>
          <span>Now</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Performance Analytics
        </h2>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value="all">All Services</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          
          <div className="flex items-center gap-2">
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              <LineChart className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('bar')}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
            >
              <Activity className="h-4 w-4" />
            </Button>
          </div>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Response Time</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-400">
                {selectedService === 'all' 
                  ? Math.round(services.reduce((sum, s) => sum + s.responseTime, 0) / services.length)
                  : services.find(s => s.id === selectedService)?.responseTime || 0
                }ms
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingDown className="h-3 w-3" />
                8.2% better
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Error Rate</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-red-400">
                {selectedService === 'all' 
                  ? (services.reduce((sum, s) => sum + s.errorRate, 0) / services.length).toFixed(2)
                  : services.find(s => s.id === selectedService)?.errorRate.toFixed(2) || '0.00'
                }%
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingDown className="h-3 w-3" />
                0.3% better
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Throughput</span>
            <Zap className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-yellow-400">
                {selectedService === 'all' 
                  ? Math.round(services.reduce((sum, s) => sum + s.throughput, 0))
                  : services.find(s => s.id === selectedService)?.throughput || 0
                } req/min
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="h-3 w-3" />
                12.4% higher
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Uptime</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-green-400">
                {selectedService === 'all' 
                  ? (services.reduce((sum, s) => sum + s.uptime, 0) / services.length).toFixed(2)
                  : services.find(s => s.id === selectedService)?.uptime.toFixed(2) || '0.00'
                }%
              </p>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="h-3 w-3" />
                0.05% better
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Performance Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Performance Trends</h3>
          
          <div className="flex items-center gap-2">
            <Button
              variant={metricType === 'response-time' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMetricType('response-time')}
            >
              Response Time
            </Button>
            <Button
              variant={metricType === 'error-rate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMetricType('error-rate')}
            >
              Error Rate
            </Button>
            <Button
              variant={metricType === 'throughput' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMetricType('throughput')}
            >
              Throughput
            </Button>
          </div>
        </div>
        
        <PerformanceChart data={performanceData} type={metricType} />
      </Card>

      {/* Service Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Service Performance Comparison</h3>
          <div className="space-y-4">
            {services.map(service => {
              const trend = Math.random() > 0.5 ? 1 : -1;
              const trendValue = (Math.random() * 10).toFixed(1);
              
              return (
                <div key={service.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getServiceStatusIcon(service.status)}
                    <div>
                      <h4 className="font-medium">{service.name}</h4>
                      <p className="text-xs text-gray-400">v{service.version}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <p className="font-medium">{service.responseTime}ms</p>
                      <div className={`flex items-center gap-1 text-xs ${
                        trend > 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {trend > 0 ? 
                          <TrendingUp className="h-3 w-3" /> : 
                          <TrendingDown className="h-3 w-3" />
                        }
                        {trendValue}%
                      </div>
                    </div>
                    
                    <div className="w-16">
                      <Progress 
                        value={service.uptime} 
                        className="h-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">{service.uptime}%</p>
                    </div>
                    
                    <Badge variant="outline" className={getServiceStatusColor(service.status)}>
                      {service.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-400 mb-1">Excellent Performance</h4>
                  <p className="text-sm text-gray-300">
                    All services are operating within optimal parameters. Response times have improved by 8.2% this week.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-400 mb-1">Monitor ArgoCD Performance</h4>
                  <p className="text-sm text-gray-300">
                    ArgoCD response times are higher than other services. Consider scaling or optimization.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-400 mb-1">Traffic Growth</h4>
                  <p className="text-sm text-gray-300">
                    Overall throughput has increased by 12.4% compared to last week. Infrastructure is handling the load well.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-400 mb-1">Optimization Opportunities</h4>
                  <p className="text-sm text-gray-300">
                    Database queries could be optimized to reduce latency by an estimated 15-20ms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Historical Performance Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Historical Performance Summary</h3>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Last 30 Days
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-bold text-green-400">99.94%</p>
            <p className="text-sm text-gray-400 mt-1">Average Uptime</p>
            <div className="flex items-center justify-center gap-1 text-xs text-green-400 mt-2">
              <TrendingUp className="h-3 w-3" />
              +0.05%
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-400">156ms</p>
            <p className="text-sm text-gray-400 mt-1">Avg Response Time</p>
            <div className="flex items-center justify-center gap-1 text-xs text-green-400 mt-2">
              <TrendingDown className="h-3 w-3" />
              -12ms
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-400">847K</p>
            <p className="text-sm text-gray-400 mt-1">Total Requests</p>
            <div className="flex items-center justify-center gap-1 text-xs text-green-400 mt-2">
              <TrendingUp className="h-3 w-3" />
              +15.2%
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-900/50 rounded-lg">
            <p className="text-2xl font-bold text-red-400">0.67%</p>
            <p className="text-sm text-gray-400 mt-1">Error Rate</p>
            <div className="flex items-center justify-center gap-1 text-xs text-green-400 mt-2">
              <TrendingDown className="h-3 w-3" />
              -0.23%
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}