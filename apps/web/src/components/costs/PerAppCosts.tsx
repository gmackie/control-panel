'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  Server,
  Database,
  Globe,
  Cpu,
  HardDrive,
  Zap,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

interface IntegrationCost {
  integrationId: string;
  integrationType: string;
  amount: number;
  usage: Array<{
    name: string;
    value: number;
    unit: string;
    limit?: number;
    percentUsed?: number;
  }>;
  planName?: string;
  status: string;
}

interface ApplicationCostData {
  applicationId: string;
  applicationName: string;
  totalMonthly: number;
  integrations: IntegrationCost[];
}

interface IntegrationCostsResponse {
  success: boolean;
  summary: {
    totalMonthly: number;
    globalCosts: number;
    applicationCosts: number;
    currency: string;
  };
  global: {
    totalMonthly: number;
    byCategory: Record<string, number>;
    byIntegration: Record<string, {
      name: string;
      amount: number;
      usage: Array<{ name: string; value: number; unit: string }>;
      status: string;
    }>;
  };
  applications: ApplicationCostData[];
}

async function fetchIntegrationCosts(): Promise<IntegrationCostsResponse> {
  const response = await fetch('/api/costs/integrations');
  if (!response.ok) {
    throw new Error('Failed to fetch integration costs');
  }
  return response.json();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function getIntegrationIcon(type: string) {
  switch (type) {
    case 'planetscale':
    case 'turso':
    case 'supabase':
    case 'neon':
      return <Database className="h-4 w-4" />;
    case 'vercel':
    case 'cloudflare':
      return <Globe className="h-4 w-4" />;
    case 'stripe':
      return <DollarSign className="h-4 w-4" />;
    case 'openrouter':
    case 'openai':
    case 'anthropic':
    case 'elevenlabs':
      return <Zap className="h-4 w-4" />;
    default:
      return <Server className="h-4 w-4" />;
  }
}

function getIntegrationColor(type: string): string {
  const colors: Record<string, string> = {
    planetscale: 'bg-black',
    turso: 'bg-teal-500',
    supabase: 'bg-green-500',
    neon: 'bg-green-400',
    clerk: 'bg-purple-500',
    vercel: 'bg-white text-black',
    expo: 'bg-blue-500',
    stripe: 'bg-purple-600',
    openrouter: 'bg-orange-500',
    openai: 'bg-green-600',
    sendgrid: 'bg-blue-600',
    twilio: 'bg-red-500',
    posthog: 'bg-blue-400',
  };
  return colors[type] || 'bg-gray-500';
}

interface AppCostCardProps {
  app: ApplicationCostData;
  expanded: boolean;
  onToggle: () => void;
  totalAppCosts: number;
}

function AppCostCard({ app, expanded, onToggle, totalAppCosts }: AppCostCardProps) {
  const percentage = totalAppCosts > 0 ? (app.totalMonthly / totalAppCosts) * 100 : 0;
  
  // Group integrations by category
  const byCategory: Record<string, IntegrationCost[]> = {};
  for (const integration of app.integrations) {
    const category = getCategoryFromType(integration.integrationType);
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(integration);
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {app.applicationName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="text-left">
            <h3 className="font-semibold">{app.applicationName}</h3>
            <p className="text-sm text-muted-foreground">
              {app.integrations.length} service{app.integrations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-semibold text-lg">{formatCurrency(app.totalMonthly)}</p>
            <p className="text-sm text-muted-foreground">{percentage.toFixed(1)}% of total</p>
          </div>
          <div className="w-24">
            <Progress value={percentage} className="h-2" />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {Object.entries(byCategory).map(([category, integrations]) => (
            <div key={category} className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {category}
              </h4>
              <div className="space-y-2">
                {integrations.map((integration) => (
                  <div
                    key={integration.integrationId}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white ${getIntegrationColor(integration.integrationType)}`}>
                        {getIntegrationIcon(integration.integrationType)}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{integration.integrationType}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {integration.planName && (
                            <Badge variant="outline" className="text-xs py-0">
                              {integration.planName}
                            </Badge>
                          )}
                          {integration.usage.slice(0, 2).map((u, i) => (
                            <span key={i}>
                              {formatNumber(u.value)} {u.unit}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(integration.amount)}</p>
                      {integration.usage[0]?.percentUsed !== undefined && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <div className="w-16">
                            <Progress 
                              value={integration.usage[0].percentUsed} 
                              className={`h-1 ${integration.usage[0].percentUsed > 80 ? '[&>div]:bg-yellow-500' : ''}`}
                            />
                          </div>
                          <span>{integration.usage[0].percentUsed.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="mt-4 pt-3 border-t flex justify-between items-center">
            <Link 
              href={`/applications/${app.applicationId}`}
              className="text-sm text-blue-500 hover:text-blue-400 flex items-center gap-1"
            >
              View application details
              <ExternalLink className="h-3 w-3" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Last updated: just now
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function getCategoryFromType(type: string): string {
  const categories: Record<string, string> = {
    planetscale: 'Databases',
    turso: 'Databases',
    supabase: 'Databases',
    neon: 'Databases',
    vercel: 'Hosting',
    stripe: 'Payments',
    openrouter: 'AI Services',
    openai: 'AI Services',
    anthropic: 'AI Services',
    elevenlabs: 'AI Services',
    sendgrid: 'Email',
    resend: 'Email',
    twilio: 'Messaging',
    cloudflare: 'CDN & Storage',
    uploadthing: 'CDN & Storage',
  };
  return categories[type] || 'Other';
}

interface GlobalCostsSectionProps {
  data: IntegrationCostsResponse['global'];
}

function GlobalCostsSection({ data }: GlobalCostsSectionProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg">Platform Services</h3>
          <Badge variant="secondary">Global</Badge>
        </div>
        <p className="text-xl font-bold">{formatCurrency(data.totalMonthly)}/mo</p>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Shared services used across all applications
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(data.byIntegration).map(([type, info]) => (
          <div key={type} className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white ${getIntegrationColor(type)}`}>
                {getIntegrationIcon(type)}
              </div>
              <span className="font-medium capitalize">{type}</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(info.amount)}</p>
            {info.usage.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(info.usage[0].value)} {info.usage[0].unit}
              </p>
            )}
          </div>
        ))}
      </div>

      {Object.keys(data.byCategory).length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">By Category</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.byCategory)
              .filter(([_, amount]) => amount > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <Badge key={category} variant="outline" className="py-1">
                  {category}: {formatCurrency(amount)}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function PerAppCosts() {
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['integration-costs'],
    queryFn: fetchIntegrationCosts,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/6" />
              </div>
              <div className="h-6 bg-muted rounded w-20" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-yellow-500">
          <AlertTriangle className="h-5 w-5" />
          <p>Unable to load integration costs</p>
        </div>
      </Card>
    );
  }

  const { summary, global, applications } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Integration Costs</span>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.totalMonthly)}</p>
          <p className="text-xs text-muted-foreground">per month</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Global Platform</span>
            <Globe className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.globalCosts)}</p>
          <p className="text-xs text-muted-foreground">
            {((summary.globalCosts / summary.totalMonthly) * 100).toFixed(0)}% of total
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Application-Specific</span>
            <Cpu className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.applicationCosts)}</p>
          <p className="text-xs text-muted-foreground">
            across {applications.length} apps
          </p>
        </Card>
      </div>

      {/* Global Platform Services */}
      <GlobalCostsSection data={global} />

      {/* Per-Application Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Per-Application Costs</h3>
          <Badge variant="outline">{applications.length} applications</Badge>
        </div>

        <div className="space-y-3">
          {applications.map((app) => (
            <AppCostCard
              key={app.applicationId}
              app={app}
              expanded={expandedApp === app.applicationId}
              onToggle={() => setExpandedApp(
                expandedApp === app.applicationId ? null : app.applicationId
              )}
              totalAppCosts={summary.applicationCosts}
            />
          ))}
        </div>

        {applications.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No application-specific costs tracked yet</p>
            <p className="text-sm">Tag your resources with application labels to see per-app costs</p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default PerAppCosts;
