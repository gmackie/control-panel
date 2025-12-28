"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Zap,
  TrendingDown,
  DollarSign,
  Server,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Lightbulb,
  Target,
  Settings,
  ArrowRight,
  Info,
  Trash2,
  XCircle
} from "lucide-react";

interface CostData {
  provider: string;
  service: string;
  category: string;
  amount: number;
  usage: number;
  unit: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  savings: number;
  savingsPercentage: number;
  effort: 'easy' | 'moderate' | 'complex';
  category: 'rightsizing' | 'reserved' | 'unused' | 'optimization' | 'alternative';
  provider: string;
  service: string;
  status: 'pending' | 'in-progress' | 'completed' | 'dismissed';
  steps: string[];
}

interface CostOptimizationProps {
  costData: CostData[];
  onApplyRecommendation: (recommendation: Recommendation) => void;
}

export function CostOptimization({ costData, onApplyRecommendation }: CostOptimizationProps) {
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Generate recommendations based on cost data
  const generateRecommendations = (): Recommendation[] => {
    return [
      {
        id: 'rec-001',
        title: 'Rightsize Hetzner VPS Instances',
        description: 'Your VPS instances are using only 45% of allocated CPU on average. Consider downsizing to save costs.',
        impact: 'high',
        savings: 35.80,
        savingsPercentage: 40,
        effort: 'easy',
        category: 'rightsizing',
        provider: 'Hetzner',
        service: 'VPS Hosting',
        status: 'pending',
        steps: [
          'Review current CPU and memory usage patterns',
          'Identify instances with low utilization',
          'Test workload on smaller instance types',
          'Schedule maintenance window for migration',
          'Migrate to optimized instance sizes'
        ]
      },
      {
        id: 'rec-002',
        title: 'Enable Auto-scaling for Peak Hours',
        description: 'Implement auto-scaling to handle traffic spikes efficiently instead of running high-capacity servers 24/7.',
        impact: 'high',
        savings: 28.50,
        savingsPercentage: 32,
        effort: 'moderate',
        category: 'optimization',
        provider: 'Hetzner',
        service: 'VPS Hosting',
        status: 'pending',
        steps: [
          'Analyze traffic patterns and peak hours',
          'Configure auto-scaling policies',
          'Set up load balancer',
          'Test scaling behavior',
          'Monitor and optimize thresholds'
        ]
      },
      {
        id: 'rec-003',
        title: 'Optimize Database Queries',
        description: 'Reduce Turso database costs by optimizing slow queries and implementing caching.',
        impact: 'medium',
        savings: 8.70,
        savingsPercentage: 30,
        effort: 'moderate',
        category: 'optimization',
        provider: 'Turso',
        service: 'Database',
        status: 'in-progress',
        steps: [
          'Identify slow and expensive queries',
          'Add appropriate indexes',
          'Implement query result caching',
          'Optimize data access patterns',
          'Monitor query performance'
        ]
      },
      {
        id: 'rec-004',
        title: 'Clean Up Unused Storage',
        description: 'Remove 150GB of unused backups and old container images to reduce storage costs.',
        impact: 'low',
        savings: 7.50,
        savingsPercentage: 30,
        effort: 'easy',
        category: 'unused',
        provider: 'Hetzner',
        service: 'Storage',
        status: 'pending',
        steps: [
          'Audit current storage usage',
          'Identify unused or old data',
          'Create backup of critical data',
          'Delete unnecessary files',
          'Set up automated cleanup policies'
        ]
      },
      {
        id: 'rec-005',
        title: 'Switch to Cloudflare R2 for Object Storage',
        description: 'Migrate static assets to Cloudflare R2 for zero egress fees and lower storage costs.',
        impact: 'medium',
        savings: 12.30,
        savingsPercentage: 48,
        effort: 'complex',
        category: 'alternative',
        provider: 'Cloudflare',
        service: 'Storage',
        status: 'pending',
        steps: [
          'Set up Cloudflare R2 bucket',
          'Migrate existing objects',
          'Update application endpoints',
          'Test functionality',
          'Decommission old storage'
        ]
      },
      {
        id: 'rec-006',
        title: 'Implement AI Token Caching',
        description: 'Cache frequent AI responses to reduce OpenRouter API token consumption by 35%.',
        impact: 'high',
        savings: 26.25,
        savingsPercentage: 35,
        effort: 'moderate',
        category: 'optimization',
        provider: 'OpenRouter',
        service: 'AI API',
        status: 'pending',
        steps: [
          'Analyze common AI queries',
          'Implement response caching layer',
          'Set appropriate TTL values',
          'Monitor cache hit rates',
          'Optimize caching strategy'
        ]
      }
    ];
  };

  const recommendations = generateRecommendations();

  // Filter recommendations
  const filteredRecommendations = filterCategory === 'all' 
    ? recommendations 
    : recommendations.filter(r => r.category === filterCategory);

  // Calculate totals
  const totalSavings = recommendations.reduce((sum, r) => sum + r.savings, 0);
  const implementedSavings = recommendations
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + r.savings, 0);
  const pendingSavings = recommendations
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + r.savings, 0);

  const getImpactIcon = (impact: Recommendation['impact']) => {
    switch (impact) {
      case 'high':
        return <Zap className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Zap className="h-4 w-4 text-blue-500" />;
    }
  };

  const getImpactColor = (impact: Recommendation['impact']) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
    }
  };

  const getEffortColor = (effort: Recommendation['effort']) => {
    switch (effort) {
      case 'easy':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'moderate':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'complex':
        return 'bg-red-500/20 text-red-400 border-red-500';
    }
  };

  const getCategoryIcon = (category: Recommendation['category']) => {
    switch (category) {
      case 'rightsizing':
        return <Server className="h-4 w-4" />;
      case 'reserved':
        return <Clock className="h-4 w-4" />;
      case 'unused':
        return <Trash2 className="h-4 w-4" />;
      case 'optimization':
        return <Settings className="h-4 w-4" />;
      case 'alternative':
        return <ArrowRight className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: Recommendation['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'in-progress':
        return <Settings className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'dismissed':
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-400">Total Potential</p>
              <p className="text-2xl font-bold">${totalSavings.toFixed(2)}</p>
              <p className="text-xs text-gray-400">per month</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-400">Implemented</p>
              <p className="text-2xl font-bold">${implementedSavings.toFixed(2)}</p>
              <p className="text-xs text-gray-400">realized savings</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-2xl font-bold">${pendingSavings.toFixed(2)}</p>
              <p className="text-xs text-gray-400">to implement</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-400">Recommendations</p>
              <p className="text-2xl font-bold">{recommendations.length}</p>
              <p className="text-xs text-gray-400">total identified</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Quick Win</h3>
        </div>
        <p className="text-sm text-gray-300 mb-4">
          Implement these easy optimizations for immediate savings with minimal effort.
        </p>
        <div className="flex items-center gap-4">
          <Button size="sm">
            <Zap className="h-4 w-4 mr-2" />
            Apply All Easy Fixes
          </Button>
          <span className="text-sm text-gray-400">
            Save ${recommendations.filter(r => r.effort === 'easy').reduce((sum, r) => sum + r.savings, 0).toFixed(2)}/mo
          </span>
        </div>
      </Card>

      {/* Category Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Filter by category:</span>
          {['all', 'rightsizing', 'optimization', 'unused', 'alternative'].map(category => (
            <Badge
              key={category}
              variant={filterCategory === category ? 'default' : 'outline'}
              className="cursor-pointer capitalize"
              onClick={() => setFilterCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.map(recommendation => (
          <Card key={recommendation.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                {getCategoryIcon(recommendation.category)}
                <div>
                  <h3 className="font-semibold text-lg mb-1">{recommendation.title}</h3>
                  <p className="text-sm text-gray-400 mb-3">{recommendation.description}</p>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getImpactColor(recommendation.impact)}>
                      {getImpactIcon(recommendation.impact)}
                      {recommendation.impact} impact
                    </Badge>
                    <Badge variant="outline" className={getEffortColor(recommendation.effort)}>
                      {recommendation.effort} effort
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {recommendation.category}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(recommendation.status)}
                      <span className="text-xs text-gray-400">{recommendation.status}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">${recommendation.savings.toFixed(2)}</p>
                <p className="text-sm text-gray-400">per month</p>
                <p className="text-xs text-gray-500">({recommendation.savingsPercentage}% reduction)</p>
              </div>
            </div>

            {/* Service Info */}
            <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
              <span>Provider: {recommendation.provider}</span>
              <span>•</span>
              <span>Service: {recommendation.service}</span>
            </div>

            {/* Implementation Steps (expandable) */}
            {selectedRecommendation === recommendation.id && (
              <div className="mb-4 p-4 bg-gray-900/50 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Implementation Steps
                </h4>
                <div className="space-y-2">
                  {recommendation.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500">{index + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => onApplyRecommendation(recommendation)}
                disabled={recommendation.status === 'completed'}
              >
                {recommendation.status === 'in-progress' ? 'Continue' : 'Apply'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecommendation(
                  selectedRecommendation === recommendation.id ? null : recommendation.id
                )}
              >
                <Info className="h-4 w-4 mr-1" />
                {selectedRecommendation === recommendation.id ? 'Hide' : 'View'} Steps
              </Button>
              {recommendation.status === 'pending' && (
                <Button variant="ghost" size="sm">
                  Dismiss
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Savings Progress */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingDown className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Optimization Progress</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Overall Progress</span>
              <span className="text-sm font-medium">
                {((implementedSavings / totalSavings) * 100).toFixed(1)}% completed
              </span>
            </div>
            <Progress value={(implementedSavings / totalSavings) * 100} className="h-3" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-gray-800">
            <div>
              <p className="text-xs text-gray-400 mb-1">Completed</p>
              <p className="text-lg font-semibold">
                {recommendations.filter(r => r.status === 'completed').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">In Progress</p>
              <p className="text-lg font-semibold">
                {recommendations.filter(r => r.status === 'in-progress').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Pending</p>
              <p className="text-lg font-semibold">
                {recommendations.filter(r => r.status === 'pending').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Monthly Savings</p>
              <p className="text-lg font-semibold text-green-400">
                ${implementedSavings.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}