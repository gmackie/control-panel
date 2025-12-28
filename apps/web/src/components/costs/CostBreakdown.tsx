"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Server,
  Database,
  Globe,
  Cloud,
  CreditCard,
  Zap,
  PieChart,
  BarChart3
} from "lucide-react";

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

interface CostBreakdownProps {
  costData: CostData[];
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
}

export function CostBreakdown({ costData, selectedProvider, onProviderChange }: CostBreakdownProps) {
  const getCategoryIcon = (category: CostData['category']) => {
    switch (category) {
      case 'compute':
        return <Server className="h-4 w-4" />;
      case 'storage':
        return <Database className="h-4 w-4" />;
      case 'network':
        return <Globe className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'api':
        return <Zap className="h-4 w-4" />;
      default:
        return <Cloud className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: CostData['category']) => {
    switch (category) {
      case 'compute':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'storage':
        return 'bg-purple-500/20 text-purple-400 border-purple-500';
      case 'network':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'database':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'api':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getTrendIcon = (trend: CostData['trend'], percentChange: number) => {
    if (trend === 'up') {
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    } else if (trend === 'down') {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    } else {
      return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: CostData['trend']) => {
    switch (trend) {
      case 'up':
        return 'text-red-400';
      case 'down':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  // Filter data based on selected provider
  const filteredData = selectedProvider === 'all' 
    ? costData 
    : costData.filter(item => item.provider === selectedProvider);

  // Calculate totals by category
  const categoryTotals = filteredData.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalAmount = filteredData.reduce((sum, item) => sum + item.amount, 0);

  // Get unique providers for filter
  const providers = Array.from(new Set(costData.map(item => item.provider)));

  // Group by provider
  const providerGroups = filteredData.reduce((acc, item) => {
    if (!acc[item.provider]) {
      acc[item.provider] = [];
    }
    acc[item.provider].push(item);
    return acc;
  }, {} as Record<string, CostData[]>);

  return (
    <div className="space-y-6">
      {/* Provider Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400">Filter by provider:</span>
          <Badge
            variant={selectedProvider === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => onProviderChange('all')}
          >
            All Providers
          </Badge>
          {providers.map(provider => (
            <Badge
              key={provider}
              variant={selectedProvider === provider ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => onProviderChange(provider)}
            >
              {provider}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Category Summary */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <PieChart className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Cost by Category</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(categoryTotals).map(([category, amount]) => {
            const percentage = (amount / totalAmount) * 100;
            return (
              <Card key={category} className="p-4 border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  {getCategoryIcon(category as CostData['category'])}
                  <span className="capitalize font-medium">{category}</span>
                </div>
                <p className="text-xl font-bold mb-2">${amount.toFixed(2)}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">% of total</span>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={percentage} className="h-1" />
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* Detailed Service Breakdown */}
      <div className="space-y-4">
        {Object.entries(providerGroups).map(([provider, services]) => {
          const providerTotal = services.reduce((sum, item) => sum + item.amount, 0);
          const providerPercentage = (providerTotal / totalAmount) * 100;

          return (
            <Card key={provider} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{provider}</h3>
                  <p className="text-sm text-gray-400">
                    {services.length} service{services.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${providerTotal.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">{providerPercentage.toFixed(1)}% of total</p>
                </div>
              </div>

              <div className="space-y-3">
                {services.map((service, index) => (
                  <div key={index} className="p-3 bg-gray-900/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getCategoryIcon(service.category)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{service.service}</h4>
                            <Badge variant="outline" className={getCategoryColor(service.category)}>
                              {service.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>
                              Usage: {service.usage.toLocaleString()} {service.unit}
                            </span>
                            <span>
                              Rate: ${(service.amount / service.usage).toFixed(4)}/{service.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-lg font-semibold">${service.amount.toFixed(2)}</p>
                        <div className="flex items-center gap-1 justify-end">
                          {getTrendIcon(service.trend, service.percentChange)}
                          <span className={`text-sm ${getTrendColor(service.trend)}`}>
                            {service.percentChange > 0 ? '+' : ''}{service.percentChange}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Service cost breakdown bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Cost allocation</span>
                        <span>{((service.amount / providerTotal) * 100).toFixed(1)}% of {provider}</span>
                      </div>
                      <Progress 
                        value={(service.amount / providerTotal) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Cost Distribution Chart */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Cost Distribution</h3>
        </div>
        
        <div className="space-y-3">
          {filteredData
            .sort((a, b) => b.amount - a.amount)
            .map((item, index) => {
              const percentage = (item.amount / totalAmount) * 100;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(item.category)}
                      <span>{item.provider} - {item.service}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${item.amount.toFixed(2)}</span>
                      <span className="text-gray-400">({percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-900 rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}