"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  BellOff,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  TrendingUp,
  Calendar,
  Settings,
  Mail,
  MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  alertThreshold: number;
  status: 'under' | 'warning' | 'over';
  services: string[];
  notifications: {
    email: boolean;
    sms: boolean;
    webhook: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

interface BudgetAlert {
  id: string;
  budgetId: string;
  type: 'warning' | 'critical' | 'exceeded';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface BudgetAlertsProps {
  budgets: Budget[];
  onUpdateBudget: (budgetId: string, updates: Partial<Budget>) => void;
  onCreateBudget: (budget: Partial<Budget>) => void;
}

export function BudgetAlerts({ budgets, onUpdateBudget, onCreateBudget }: BudgetAlertsProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [alerts] = useState<BudgetAlert[]>([
    {
      id: 'alert-001',
      budgetId: 'budget-002',
      type: 'warning',
      message: 'Third-party APIs budget has reached 91% of the monthly limit',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      acknowledged: false
    },
    {
      id: 'alert-002',
      budgetId: 'budget-001',
      type: 'exceeded',
      message: 'Infrastructure budget exceeded by $15.20',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      acknowledged: true
    }
  ]);

  const getStatusIcon = (status: Budget['status']) => {
    switch (status) {
      case 'under':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'over':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: Budget['status']) => {
    switch (status) {
      case 'under':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'over':
        return 'bg-red-500/20 text-red-400 border-red-500';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '[&>div]:bg-red-500';
    if (percentage >= 80) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-green-500';
  };

  const getAlertTypeIcon = (type: BudgetAlert['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'exceeded':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getAlertTypeColor = (type: BudgetAlert['type']) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'critical':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'exceeded':
        return 'bg-red-500/20 text-red-400 border-red-500';
    }
  };

  // Calculate totals
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetsAtRisk = budgets.filter(b => b.status === 'warning').length;
  const budgetsExceeded = budgets.filter(b => b.status === 'over').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Budget Management
          </h2>
          <p className="text-gray-400 text-sm">
            Set spending limits and receive alerts when thresholds are reached
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Budget
        </Button>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-400">Total Budget</p>
              <p className="text-2xl font-bold">${totalBudget.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-400">Total Spent</p>
              <p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-400">Remaining</p>
              <p className="text-2xl font-bold">${totalRemaining.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-400">At Risk</p>
              <p className="text-2xl font-bold">{budgetsAtRisk + budgetsExceeded}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.filter(a => !a.acknowledged).length > 0 && (
        <Card className="p-6 border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold">Active Alerts</h3>
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
              {alerts.filter(a => !a.acknowledged).length}
            </Badge>
          </div>
          <div className="space-y-3">
            {alerts.filter(a => !a.acknowledged).map(alert => {
              const budget = budgets.find(b => b.id === alert.budgetId);
              return (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getAlertTypeIcon(alert.type)}
                    <div>
                      <p className="font-medium text-sm">{alert.message}</p>
                      <p className="text-xs text-gray-400">
                        {budget?.name} • {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getAlertTypeColor(alert.type)}>
                    {alert.type}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Budget List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgets.map(budget => {
          const percentage = (budget.spent / budget.amount) * 100;
          const remaining = budget.amount - budget.spent;
          const daysInPeriod = budget.period === 'monthly' ? 30 : budget.period === 'quarterly' ? 90 : 365;
          const dailyBudget = budget.amount / daysInPeriod;
          const burnRate = budget.spent / (daysInPeriod * 0.5); // Assuming halfway through period

          return (
            <Card key={budget.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{budget.name}</h3>
                  <p className="text-sm text-gray-400 capitalize">{budget.period} budget</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getStatusColor(budget.status)}>
                    {getStatusIcon(budget.status)}
                    {budget.status}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBudget(budget.id)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Budget Progress */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">${budget.spent.toFixed(2)}</span>
                  <span className="text-sm text-gray-400">of ${budget.amount.toFixed(2)}</span>
                </div>
                <Progress value={percentage} className={`h-3 ${getProgressColor(percentage)}`} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{percentage.toFixed(1)}% used</span>
                  <span className={remaining < 0 ? 'text-red-400' : 'text-green-400'}>
                    ${Math.abs(remaining).toFixed(2)} {remaining < 0 ? 'over' : 'remaining'}
                  </span>
                </div>
              </div>

              {/* Budget Details */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Daily Budget</p>
                  <p className="font-medium">${dailyBudget.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Burn Rate</p>
                  <p className="font-medium">
                    ${burnRate.toFixed(2)}/day
                    {burnRate > dailyBudget && (
                      <TrendingUp className="inline h-3 w-3 text-red-500 ml-1" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Alert Threshold</p>
                  <p className="font-medium">{budget.alertThreshold}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Services</p>
                  <p className="font-medium">{budget.services.length} tracked</p>
                </div>
              </div>

              {/* Services */}
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Monitored Services</p>
                <div className="flex flex-wrap gap-1">
                  {budget.services.slice(0, 3).map(service => (
                    <Badge key={service} variant="secondary" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                  {budget.services.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{budget.services.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Notifications */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-800">
                <span className="text-xs text-gray-400">Notifications:</span>
                <div className="flex items-center gap-2">
                  {budget.notifications?.email ? (
                    <Mail className="h-4 w-4 text-green-500" />
                  ) : (
                    <Mail className="h-4 w-4 text-gray-600" />
                  )}
                  {budget.notifications?.sms ? (
                    <MessageSquare className="h-4 w-4 text-green-500" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-gray-600" />
                  )}
                  {budget.notifications?.webhook ? (
                    <Bell className="h-4 w-4 text-green-500" />
                  ) : (
                    <BellOff className="h-4 w-4 text-gray-600" />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Budget Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Budget</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                onCreateBudget({
                  name: formData.get('name') as string,
                  amount: parseFloat(formData.get('amount') as string),
                  period: formData.get('period') as Budget['period'],
                  alertThreshold: parseInt(formData.get('threshold') as string),
                  services: [],
                  spent: 0,
                  status: 'under',
                  notifications: {
                    email: formData.get('email') === 'on',
                    sms: formData.get('sms') === 'on',
                    webhook: formData.get('webhook') === 'on'
                  }
                });
                setShowCreateForm(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">Budget Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                  placeholder="e.g., Infrastructure"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Amount ($)</label>
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                  placeholder="500.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Period</label>
                <select
                  name="period"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Alert Threshold (%)</label>
                <input
                  type="number"
                  name="threshold"
                  min="50"
                  max="100"
                  defaultValue="80"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notifications</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="email" defaultChecked />
                    <span>Email notifications</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="sms" />
                    <span>SMS notifications</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="webhook" />
                    <span>Webhook notifications</span>
                  </label>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button type="submit" className="flex-1">
                  Create Budget
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
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