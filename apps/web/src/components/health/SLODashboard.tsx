"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  AlertCircle,
  Calendar,
  Settings,
  BarChart3
} from "lucide-react";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";

interface SLO {
  target: number;
  current: number;
  period: '7d' | '30d' | '90d';
  errorBudget: {
    remaining: number;
    consumed: number;
    total: number;
  };
}

interface ServiceWithSLO {
  id: string;
  name: string;
  type: 'application' | 'database' | 'external_api' | 'infrastructure';
  status: 'healthy' | 'degraded' | 'down' | 'maintenance';
  slo: SLO;
  metrics: {
    availability: number;
    responseTime: {
      p50: number;
      p95: number;
      p99: number;
    };
    errorRate: number;
  };
}

interface SLODashboardProps {
  services: ServiceWithSLO[];
  onUpdateSLO: (serviceId: string, slo: Partial<SLO>) => void;
}

export function SLODashboard({ services, onUpdateSLO }: SLODashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [showConfigModal, setShowConfigModal] = useState<string | null>(null);

  const getSLOStatus = (slo: SLO) => {
    const errorBudgetPercentage = (slo.errorBudget.remaining / slo.errorBudget.total) * 100;
    if (slo.current >= slo.target) return 'meeting';
    if (errorBudgetPercentage > 25) return 'at-risk';
    return 'breaching';
  };

  const getSLOStatusColor = (status: string) => {
    switch (status) {
      case 'meeting':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'at-risk':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'breaching':
        return 'bg-red-500/20 text-red-400 border-red-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getSLOStatusIcon = (status: string) => {
    switch (status) {
      case 'meeting':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'at-risk':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'breaching':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (current: number, target: number) => {
    if (current >= target) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  // Calculate overall SLO performance
  const meetingSLO = services.filter(s => getSLOStatus(s.slo) === 'meeting').length;
  const atRisk = services.filter(s => getSLOStatus(s.slo) === 'at-risk').length;
  const breaching = services.filter(s => getSLOStatus(s.slo) === 'breaching').length;

  const getDaysLeft = (period: string) => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    return Math.max(0, days - new Date().getDate());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Service Level Objectives
          </h2>
          <p className="text-gray-400 text-sm">
            Monitor SLA compliance and error budget consumption
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Period:</span>
          {(['7d', '30d', '90d'] as const).map(period => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </Button>
          ))}
        </div>
      </div>

      {/* SLO Overview */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">SLO Overview</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{meetingSLO}</p>
            <p className="text-sm text-gray-400">Meeting SLO</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold">{atRisk}</p>
            <p className="text-sm text-gray-400">At Risk</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-2xl font-bold">{breaching}</p>
            <p className="text-sm text-gray-400">Breaching</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{services.length}</p>
            <p className="text-sm text-gray-400">Total Services</p>
          </div>
        </div>
      </Card>

      {/* SLO Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {services.map(service => {
          const sloStatus = getSLOStatus(service.slo);
          const errorBudgetPercentage = (service.slo.errorBudget.remaining / service.slo.errorBudget.total) * 100;
          const daysLeft = getDaysLeft(service.slo.period);

          return (
            <Card key={service.id} className="p-6">
              {/* Service Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold flex items-center gap-2">
                    {service.name}
                    {getTrendIcon(service.slo.current, service.slo.target)}
                  </h4>
                  <p className="text-sm text-gray-400 capitalize">
                    {service.type.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getSLOStatusColor(sloStatus)}>
                    {getSLOStatusIcon(sloStatus)}
                    {sloStatus.replace('-', ' ')}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfigModal(service.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* SLO Metrics */}
              <div className="space-y-4">
                {/* Availability SLO */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Availability SLO</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {service.slo.current.toFixed(3)}% / {service.slo.target.toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-400">Current / Target</p>
                    </div>
                  </div>
                  <Progress 
                    value={(service.slo.current / service.slo.target) * 100} 
                    className="h-2"
                  />
                </div>

                {/* Error Budget */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Error Budget</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {errorBudgetPercentage.toFixed(1)}% remaining
                      </p>
                      <p className="text-xs text-gray-400">
                        {service.slo.errorBudget.remaining} / {service.slo.errorBudget.total}
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={errorBudgetPercentage} 
                    className={`h-2 ${
                      errorBudgetPercentage < 25 ? '[&>div]:bg-red-500' : 
                      errorBudgetPercentage < 50 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
                    }`}
                  />
                </div>

                {/* Period Info */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>Period: {service.slo.period}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {daysLeft} days remaining
                  </div>
                </div>

                {/* Quick Metrics */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">P95 Response</p>
                    <p className="text-sm font-semibold">{service.metrics.responseTime.p95}ms</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Error Rate</p>
                    <p className="text-sm font-semibold">{service.metrics.errorRate.toFixed(2)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Uptime</p>
                    <p className="text-sm font-semibold">{service.metrics.availability.toFixed(2)}%</p>
                  </div>
                </div>

                {/* Alert if breaching */}
                {sloStatus === 'breaching' && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">SLO Breach Alert</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">
                      Service is not meeting SLO target. Error budget will be exhausted soon.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {services.length === 0 && (
        <Card className="p-12 text-center">
          <Shield className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No SLOs Configured</h3>
          <p className="text-gray-500 mb-4">
            Set up Service Level Objectives to track service reliability and error budgets
          </p>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Configure SLOs
          </Button>
        </Card>
      )}

      {/* SLO Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Configure SLO</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const target = parseFloat(formData.get('target') as string);
                const period = formData.get('period') as '7d' | '30d' | '90d';
                
                onUpdateSLO(showConfigModal, {
                  target,
                  period,
                });
                setShowConfigModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">Target (%)</label>
                <input
                  type="number"
                  name="target"
                  min="90"
                  max="99.99"
                  step="0.01"
                  defaultValue="99.9"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                  placeholder="99.9"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Period</label>
                <select
                  name="period"
                  defaultValue="30d"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                >
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button type="submit" className="flex-1">
                  Update SLO
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfigModal(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}