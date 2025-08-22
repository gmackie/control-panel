"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Settings,
  Download,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Server,
  Cloud,
  Database,
  Globe,
  CreditCard,
  Target,
  Zap,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { formatDistanceToNow, format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { CostBreakdown } from "@/components/costs/CostBreakdown";
import { UsageAnalytics } from "@/components/costs/UsageAnalytics";
import { BudgetAlerts } from "@/components/costs/BudgetAlerts";
import { CostOptimization } from "@/components/costs/CostOptimization";

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

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  alertThreshold: number;
  status: 'under' | 'warning' | 'over';
  services: string[];
}

interface Forecast {
  period: string;
  projected: number;
  confidence: number;
  basedOn: string;
}

export default function CostsPage() {
  const [costData, setCostData] = useState<CostData[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  useEffect(() => {
    fetchCostData();
  }, [selectedPeriod]);

  const fetchCostData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/costs?period=${selectedPeriod}`);
      const data = await response.json();
      
      setCostData(data.costs || []);
      setBudgets(data.budgets || []);
      setForecasts(data.forecasts || []);
    } catch (error) {
      console.error('Error fetching cost data:', error);
      // Use mock data as fallback
      setCostData(generateMockCostData());
      setBudgets(generateMockBudgets());
      setForecasts(generateMockForecasts());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockCostData = (): CostData[] => {
    const now = new Date();
    return [
      {
        provider: 'Hetzner',
        service: 'VPS Hosting',
        category: 'compute',
        amount: 89.50,
        usage: 4,
        unit: 'servers',
        period: now,
        trend: 'stable',
        percentChange: 0
      },
      {
        provider: 'Hetzner',
        service: 'Storage',
        category: 'storage',
        amount: 25.30,
        usage: 500,
        unit: 'GB',
        period: now,
        trend: 'up',
        percentChange: 12
      },
      {
        provider: 'Cloudflare',
        service: 'CDN & DNS',
        category: 'network',
        amount: 20.00,
        usage: 1000000,
        unit: 'requests',
        period: now,
        trend: 'down',
        percentChange: -5
      },
      {
        provider: 'Turso',
        service: 'Database',
        category: 'database',
        amount: 29.00,
        usage: 50,
        unit: 'GB',
        period: now,
        trend: 'up',
        percentChange: 8
      },
      {
        provider: 'Stripe',
        service: 'Payment Processing',
        category: 'api',
        amount: 145.80,
        usage: 486,
        unit: 'transactions',
        period: now,
        trend: 'up',
        percentChange: 25
      },
      {
        provider: 'SendGrid',
        service: 'Email Service',
        category: 'api',
        amount: 14.95,
        usage: 15000,
        unit: 'emails',
        period: now,
        trend: 'stable',
        percentChange: 2
      },
      {
        provider: 'OpenRouter',
        service: 'AI API',
        category: 'api',
        amount: 75.00,
        usage: 500000,
        unit: 'tokens',
        period: now,
        trend: 'up',
        percentChange: 35
      },
      {
        provider: 'Twilio',
        service: 'SMS Service',
        category: 'api',
        amount: 8.50,
        usage: 850,
        unit: 'messages',
        period: now,
        trend: 'down',
        percentChange: -10
      }
    ];
  };

  const generateMockBudgets = (): Budget[] => {
    return [
      {
        id: 'budget-001',
        name: 'Infrastructure',
        amount: 200,
        spent: 134.80,
        period: 'monthly',
        alertThreshold: 80,
        status: 'under',
        services: ['Hetzner', 'Cloudflare']
      },
      {
        id: 'budget-002',
        name: 'Third-party APIs',
        amount: 300,
        spent: 273.25,
        period: 'monthly',
        alertThreshold: 90,
        status: 'warning',
        services: ['Stripe', 'SendGrid', 'OpenRouter', 'Twilio']
      },
      {
        id: 'budget-003',
        name: 'Database & Storage',
        amount: 100,
        spent: 54.30,
        period: 'monthly',
        alertThreshold: 75,
        status: 'under',
        services: ['Turso', 'Hetzner Storage']
      }
    ];
  };

  const generateMockForecasts = (): Forecast[] => {
    return [
      {
        period: 'Next Month',
        projected: 465.50,
        confidence: 85,
        basedOn: '3-month trend'
      },
      {
        period: 'Q2 2024',
        projected: 1450.00,
        confidence: 75,
        basedOn: '6-month average'
      },
      {
        period: 'End of Year',
        projected: 5800.00,
        confidence: 65,
        basedOn: 'YTD growth rate'
      }
    ];
  };

  // Calculate totals and summaries
  const totalCost = costData.reduce((sum, item) => sum + item.amount, 0);
  const previousMonthCost = totalCost * 0.92; // Mock previous month
  const costChange = ((totalCost - previousMonthCost) / previousMonthCost) * 100;
  
  const costByProvider = costData.reduce((acc, item) => {
    acc[item.provider] = (acc[item.provider] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const costByCategory = costData.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const topSpenders = Object.entries(costByProvider)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            Cost Management
          </h1>
          <p className="text-gray-400 mt-1">
            Track spending, manage budgets, and optimize costs across all services
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Current Month</span>
            <Badge variant="outline" className={costChange > 0 ? 'text-red-400' : 'text-green-400'}>
              {costChange > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
              {Math.abs(costChange).toFixed(1)}%
            </Badge>
          </div>
          <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-gray-400">vs ${previousMonthCost.toFixed(2)} last month</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Projected Month End</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">${(totalCost * 1.1).toFixed(2)}</p>
          <p className="text-xs text-gray-400">Based on current usage</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Budget Status</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">78%</p>
          <Progress value={78} className="h-2 mt-2" />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Savings Potential</span>
            <Zap className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">${(totalCost * 0.15).toFixed(2)}</p>
          <p className="text-xs text-gray-400">~15% optimization available</p>
        </Card>
      </div>

      {/* Top Spenders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-red-500" />
            Top Spenders
          </h2>
          <span className="text-sm text-gray-400">This {selectedPeriod}</span>
        </div>
        <div className="space-y-3">
          {topSpenders.map(([provider, amount], index) => {
            const percentage = (amount / totalCost) * 100;
            return (
              <div key={provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <span className="font-medium">{provider}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{percentage.toFixed(1)}% of total</p>
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList>
          <TabsTrigger value="breakdown">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="analytics">Usage Analytics</TabsTrigger>
          <TabsTrigger value="budgets">Budget Alerts</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-4">
          <CostBreakdown 
            costData={costData}
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <UsageAnalytics 
            costData={costData}
            period={selectedPeriod}
          />
        </TabsContent>

        <TabsContent value="budgets" className="space-y-4">
          <BudgetAlerts 
            budgets={budgets}
            onUpdateBudget={(budgetId, updates) => {
              console.log('Update budget:', budgetId, updates);
            }}
            onCreateBudget={(budget) => {
              console.log('Create budget:', budget);
            }}
          />
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <CostOptimization 
            costData={costData}
            onApplyRecommendation={(recommendation) => {
              console.log('Apply recommendation:', recommendation);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Forecast Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Cost Forecast</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {forecasts.map(forecast => (
            <Card key={forecast.period} className="p-4 border-gray-800">
              <h4 className="font-medium mb-2">{forecast.period}</h4>
              <p className="text-2xl font-bold mb-2">${forecast.projected.toFixed(2)}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Confidence</span>
                  <span>{forecast.confidence}%</span>
                </div>
                <Progress value={forecast.confidence} className="h-1" />
                <p className="text-xs text-gray-400">Based on {forecast.basedOn}</p>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}