"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Clock,
  Cpu,
  HardDrive,
  Network,
  Database,
  Zap,
  ArrowUp,
  ArrowDown,
  Info
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

interface CostData {
  provider: string;
  service: string;
  category: 'compute' | 'storage' | 'network' | 'database' | 'api' | 'other';
  amount: number;
  usage: number;
  unit: string;
  period: Date;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

interface UsageMetric {
  name: string;
  current: number;
  previous: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
  forecast: number;
  category: string;
}

interface UsageAnalyticsProps {
  costData: CostData[];
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export function UsageAnalytics({ costData, period }: UsageAnalyticsProps) {
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [showForecast, setShowForecast] = useState(true);

  // Generate usage metrics from cost data
  const generateUsageMetrics = (): UsageMetric[] => {
    return [
      {
        name: 'Compute Hours',
        current: 2880,
        previous: 2640,
        unit: 'hours',
        trend: 'up',
        percentChange: 9.1,
        forecast: 3100,
        category: 'compute'
      },
      {
        name: 'Storage Used',
        current: 523,
        previous: 485,
        unit: 'GB',
        trend: 'up',
        percentChange: 7.8,
        forecast: 560,
        category: 'storage'
      },
      {
        name: 'Network Transfer',
        current: 1250,
        previous: 1180,
        unit: 'GB',
        trend: 'up',
        percentChange: 5.9,
        forecast: 1320,
        category: 'network'
      },
      {
        name: 'Database Queries',
        current: 458000,
        previous: 412000,
        unit: 'queries',
        trend: 'up',
        percentChange: 11.2,
        forecast: 510000,
        category: 'database'
      },
      {
        name: 'API Calls',
        current: 1250000,
        previous: 1100000,
        unit: 'calls',
        trend: 'up',
        percentChange: 13.6,
        forecast: 1420000,
        category: 'api'
      },
      {
        name: 'Email Sent',
        current: 15234,
        previous: 14890,
        unit: 'emails',
        trend: 'up',
        percentChange: 2.3,
        forecast: 15600,
        category: 'api'
      },
      {
        name: 'SMS Messages',
        current: 845,
        previous: 923,
        unit: 'messages',
        trend: 'down',
        percentChange: -8.5,
        forecast: 775,
        category: 'api'
      },
      {
        name: 'AI Tokens',
        current: 512000,
        previous: 380000,
        unit: 'tokens',
        trend: 'up',
        percentChange: 34.7,
        forecast: 690000,
        category: 'api'
      }
    ];
  };

  const usageMetrics = generateUsageMetrics();

  // Filter metrics based on selection
  const filteredMetrics = selectedMetric === 'all' 
    ? usageMetrics 
    : usageMetrics.filter(m => m.category === selectedMetric);

  // Calculate usage efficiency
  const calculateEfficiency = (metric: UsageMetric) => {
    const costItem = costData.find(c => 
      c.category === metric.category && 
      c.unit.toLowerCase().includes(metric.unit.toLowerCase().split(' ')[0])
    );
    
    if (!costItem) return null;
    
    const costPerUnit = costItem.amount / costItem.usage;
    const efficiency = Math.max(0, 100 - (costPerUnit * 10)); // Mock efficiency calculation
    
    return {
      costPerUnit,
      efficiency,
      potentialSavings: costItem.amount * (1 - efficiency / 100) * 0.2
    };
  };

  // Generate time series data for charts
  const generateTimeSeriesData = (metric: UsageMetric) => {
    const points = 30;
    const data = [];
    const baseValue = metric.previous;
    const growth = (metric.current - metric.previous) / points;
    
    for (let i = 0; i < points; i++) {
      data.push({
        day: i + 1,
        value: Math.max(0, baseValue + (growth * i) + (Math.random() - 0.5) * baseValue * 0.1)
      });
    }
    
    return data;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'compute':
        return <Cpu className="h-4 w-4" />;
      case 'storage':
        return <HardDrive className="h-4 w-4" />;
      case 'network':
        return <Network className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'api':
        return <Zap className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Category:</span>
            {['all', 'compute', 'storage', 'network', 'database', 'api'].map(category => (
              <Badge
                key={category}
                variant={selectedMetric === category ? 'default' : 'outline'}
                className="cursor-pointer capitalize"
                onClick={() => setSelectedMetric(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForecast(!showForecast)}
          >
            {showForecast ? 'Hide' : 'Show'} Forecast
          </Button>
        </div>
      </Card>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredMetrics.slice(0, 4).map(metric => {
          const efficiency = calculateEfficiency(metric);
          
          return (
            <Card key={metric.name} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                {getCategoryIcon(metric.category)}
                <h4 className="font-medium text-sm">{metric.name}</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold">
                    {metric.current.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">{metric.unit}</p>
                </div>

                <div className="flex items-center gap-2">
                  {metric.trend === 'up' ? (
                    <ArrowUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-green-500" />
                  )}
                  <span className={`text-sm ${
                    metric.trend === 'up' ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {metric.percentChange > 0 ? '+' : ''}{metric.percentChange}%
                  </span>
                  <span className="text-xs text-gray-400">vs last {period}</span>
                </div>

                {showForecast && (
                  <div className="pt-2 border-t border-gray-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Forecast</span>
                      <span className="font-medium">{metric.forecast.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {efficiency && (
                  <div className="pt-2 border-t border-gray-800">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Efficiency</span>
                      <span>{efficiency.efficiency.toFixed(1)}%</span>
                    </div>
                    <Progress value={efficiency.efficiency} className="h-1" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Detailed Usage Analysis */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Detailed Usage Analysis</h3>
        </div>

        <div className="space-y-4">
          {filteredMetrics.map(metric => {
            const efficiency = calculateEfficiency(metric);
            const timeSeriesData = generateTimeSeriesData(metric);
            const maxValue = Math.max(...timeSeriesData.map(d => d.value));
            
            return (
              <Card key={metric.name} className="p-4 border-gray-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getCategoryIcon(metric.category)}
                      <h4 className="font-semibold">{metric.name}</h4>
                      <Badge variant="secondary" className="capitalize">
                        {metric.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400">
                      Current: {metric.current.toLocaleString()} {metric.unit}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end mb-1">
                      {metric.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                      <span className={`font-medium ${
                        metric.trend === 'up' ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {metric.percentChange > 0 ? '+' : ''}{metric.percentChange}%
                      </span>
                    </div>
                    {showForecast && (
                      <p className="text-xs text-gray-400">
                        Forecast: {metric.forecast.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mini chart */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>Usage trend (last 30 days)</span>
                    <span>{maxValue.toFixed(0)} max</span>
                  </div>
                  <div className="h-16 flex items-end gap-px">
                    {timeSeriesData.map((point, index) => (
                      <div
                        key={index}
                        className="bg-blue-500/60 flex-1 min-w-px rounded-t-sm hover:bg-blue-500 transition-colors"
                        style={{
                          height: `${(point.value / maxValue) * 100}%`,
                        }}
                        title={`Day ${point.day}: ${point.value.toFixed(0)} ${metric.unit}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Efficiency and cost analysis */}
                {efficiency && (
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-800">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Cost per unit</p>
                      <p className="font-medium">${efficiency.costPerUnit.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Efficiency score</p>
                      <div className="flex items-center gap-2">
                        <Progress value={efficiency.efficiency} className="h-2 flex-1" />
                        <span className="text-sm font-medium">{efficiency.efficiency.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Potential savings</p>
                      <p className="font-medium text-green-400">${efficiency.potentialSavings.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Card>

      {/* Usage Patterns */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Usage Patterns</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-gray-800">
            <h4 className="font-medium mb-3">Peak Usage Times</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Weekdays</span>
                <span>9 AM - 5 PM</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Weekends</span>
                <span>10 AM - 2 PM</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Peak day</span>
                <span>Wednesday</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-gray-800">
            <h4 className="font-medium mb-3">Resource Utilization</h4>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Average</span>
                  <span>68%</span>
                </div>
                <Progress value={68} className="h-2" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Peak</span>
                  <span>92%</span>
                </div>
                <Progress value={92} className="h-2" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-gray-800">
            <h4 className="font-medium mb-3">Trend Analysis</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Growth rate</span>
                <span className="text-green-400">+12.3%/mo</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Seasonality</span>
                <span>Moderate</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Predictability</span>
                <span>High (87%)</span>
              </div>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}