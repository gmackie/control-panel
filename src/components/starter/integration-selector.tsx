"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  Database,
  Mail,
  MessageSquare,
  Mic,
  Brain,
  Shield,
  Users,
  Zap,
  CheckCircle,
  Info,
  ExternalLink,
  AlertCircle,
  Code,
  Settings,
  Globe,
  Webhook,
  Check,
} from "lucide-react";

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'payment' | 'database' | 'communication' | 'ai' | 'auth' | 'monitoring' | 'observability' | 'other';
  icon: any;
  popularity: number;
  difficulty: 'easy' | 'medium' | 'hard';
  features: string[];
  dependencies: string[];
  envVars: string[];
  packages: string[];
  webhooks?: string[];
  pricing: 'free' | 'freemium' | 'paid';
  documentation: string;
}

const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and subscription management',
    category: 'payment',
    icon: CreditCard,
    popularity: 95,
    difficulty: 'easy',
    features: ['Payments', 'Subscriptions', 'Invoicing', 'Connect', 'Webhooks'],
    dependencies: [],
    envVars: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    packages: ['stripe', '@stripe/stripe-js'],
    webhooks: ['payment_intent.succeeded', 'subscription.updated', 'invoice.payment_failed'],
    pricing: 'freemium',
    documentation: 'https://stripe.com/docs',
  },
  {
    id: 'turso',
    name: 'Turso',
    description: 'Edge SQLite database with global replication',
    category: 'database',
    icon: Database,
    popularity: 78,
    difficulty: 'easy',
    features: ['Edge Database', 'Global Replication', 'SQLite', 'Migrations'],
    dependencies: [],
    envVars: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
    packages: ['@libsql/client', 'drizzle-orm', 'drizzle-kit'],
    pricing: 'freemium',
    documentation: 'https://docs.turso.tech',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with PostgreSQL',
    category: 'database',
    icon: Database,
    popularity: 88,
    difficulty: 'easy',
    features: ['PostgreSQL', 'Auth', 'Real-time', 'Storage', 'Edge Functions'],
    dependencies: [],
    envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'],
    packages: ['@supabase/supabase-js', '@supabase/auth-js'],
    pricing: 'freemium',
    documentation: 'https://supabase.com/docs',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Email delivery and marketing platform',
    category: 'communication',
    icon: Mail,
    popularity: 82,
    difficulty: 'easy',
    features: ['Transactional Email', 'Marketing Campaigns', 'Templates', 'Analytics'],
    dependencies: [],
    envVars: ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL'],
    packages: ['@sendgrid/mail'],
    webhooks: ['delivered', 'opened', 'clicked', 'bounced'],
    pricing: 'freemium',
    documentation: 'https://docs.sendgrid.com',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, voice calls, and communication APIs',
    category: 'communication',
    icon: MessageSquare,
    popularity: 75,
    difficulty: 'medium',
    features: ['SMS', 'Voice', 'WhatsApp', 'Video', 'Verify'],
    dependencies: [],
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    packages: ['twilio'],
    webhooks: ['message-status', 'call-status'],
    pricing: 'paid',
    documentation: 'https://www.twilio.com/docs',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'AI voice synthesis and text-to-speech',
    category: 'ai',
    icon: Mic,
    popularity: 65,
    difficulty: 'easy',
    features: ['Text-to-Speech', 'Voice Cloning', 'Multiple Languages'],
    dependencies: [],
    envVars: ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'],
    packages: ['elevenlabs'],
    pricing: 'freemium',
    documentation: 'https://docs.elevenlabs.io',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified API for multiple AI models',
    category: 'ai',
    icon: Brain,
    popularity: 58,
    difficulty: 'medium',
    features: ['Multiple AI Models', 'Cost Optimization', 'Fallback Models'],
    dependencies: [],
    envVars: ['OPENROUTER_API_KEY', 'OPENROUTER_DEFAULT_MODEL'],
    packages: ['openai'],
    pricing: 'paid',
    documentation: 'https://openrouter.ai/docs',
  },
  {
    id: 'clerk',
    name: 'Clerk',
    description: 'Complete authentication and user management',
    category: 'auth',
    icon: Shield,
    popularity: 72,
    difficulty: 'easy',
    features: ['Authentication', 'User Management', 'Organizations', 'Sessions'],
    dependencies: [],
    envVars: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET'],
    packages: ['@clerk/nextjs'],
    webhooks: ['user.created', 'user.updated', 'session.created'],
    pricing: 'freemium',
    documentation: 'https://clerk.com/docs',
  },
  {
    id: 'nextauth',
    name: 'NextAuth.js',
    description: 'Authentication library for Next.js',
    category: 'auth',
    icon: Users,
    popularity: 90,
    difficulty: 'medium',
    features: ['OAuth Providers', 'JWT', 'Database Sessions', 'Callbacks'],
    dependencies: [],
    envVars: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'GITHUB_ID', 'GITHUB_SECRET'],
    packages: ['next-auth'],
    pricing: 'free',
    documentation: 'https://next-auth.js.org',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error tracking and performance monitoring',
    category: 'monitoring',
    icon: AlertCircle,
    popularity: 85,
    difficulty: 'easy',
    features: ['Error Tracking', 'Performance Monitoring', 'Alerts', 'Release Health'],
    dependencies: [],
    envVars: ['SENTRY_DSN', 'SENTRY_ORG', 'SENTRY_PROJECT'],
    packages: ['@sentry/nextjs'],
    pricing: 'freemium',
    documentation: 'https://docs.sentry.io',
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Metrics collection and monitoring',
    category: 'observability',
    icon: Settings,
    popularity: 80,
    difficulty: 'medium',
    features: ['Metrics Collection', 'Custom Metrics', 'Alerting', 'Time Series DB'],
    dependencies: [],
    envVars: ['PROMETHEUS_PUSHGATEWAY_URL', 'PROMETHEUS_JOB_NAME'],
    packages: ['prom-client'],
    pricing: 'free',
    documentation: 'https://prometheus.io/docs',
  },
  {
    id: 'loki',
    name: 'Loki',
    description: 'Log aggregation and querying',
    category: 'observability',
    icon: Code,
    popularity: 75,
    difficulty: 'medium',
    features: ['Log Aggregation', 'Log Querying', 'Label-based Indexing', 'Grafana Integration'],
    dependencies: [],
    envVars: ['LOKI_PUSH_URL', 'LOKI_LABELS'],
    packages: ['winston', 'winston-loki'],
    pricing: 'free',
    documentation: 'https://grafana.com/docs/loki',
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Dashboards and visualization',
    category: 'observability',
    icon: Globe,
    popularity: 85,
    difficulty: 'easy',
    features: ['Dashboards', 'Visualizations', 'Annotations', 'Alerting'],
    dependencies: [],
    envVars: ['GRAFANA_URL', 'GRAFANA_API_KEY'],
    packages: ['axios'],
    pricing: 'freemium',
    documentation: 'https://grafana.com/docs',
  },
  {
    id: 'alertmanager',
    name: 'AlertManager',
    description: 'Alert routing and management',
    category: 'observability',
    icon: AlertCircle,
    popularity: 70,
    difficulty: 'medium',
    features: ['Alert Routing', 'Alert Grouping', 'Silencing', 'Inhibition'],
    dependencies: [],
    envVars: ['ALERTMANAGER_URL', 'ALERT_WEBHOOK_URL'],
    packages: ['axios'],
    webhooks: ['alert.firing', 'alert.resolved'],
    pricing: 'free',
    documentation: 'https://prometheus.io/docs/alerting/latest/alertmanager',
  },
];

interface IntegrationSelectorProps {
  selectedIntegrations: string[];
  onSelectionChange: (integrations: string[]) => void;
  maxSelections?: number;
}

export function IntegrationSelector({
  selectedIntegrations,
  onSelectionChange,
  maxSelections,
}: IntegrationSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const categories = [
    { id: 'all', name: 'All', icon: Zap },
    { id: 'payment', name: 'Payment', icon: CreditCard },
    { id: 'database', name: 'Database', icon: Database },
    { id: 'communication', name: 'Communication', icon: Mail },
    { id: 'ai', name: 'AI', icon: Brain },
    { id: 'auth', name: 'Authentication', icon: Shield },
    { id: 'monitoring', name: 'Monitoring', icon: AlertCircle },
    { id: 'observability', name: 'Observability', icon: Settings },
  ];

  const filteredIntegrations = AVAILABLE_INTEGRATIONS.filter(integration => {
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.features.some(feature => feature.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  }).sort((a, b) => b.popularity - a.popularity);

  const handleToggleIntegration = (integrationId: string) => {
    const isSelected = selectedIntegrations.includes(integrationId);
    
    if (isSelected) {
      onSelectionChange(selectedIntegrations.filter(id => id !== integrationId));
    } else {
      if (maxSelections && selectedIntegrations.length >= maxSelections) {
        return; // Don't allow more selections
      }
      onSelectionChange([...selectedIntegrations, integrationId]);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'hard': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getPricingColor = (pricing: string) => {
    switch (pricing) {
      case 'free': return 'text-green-500';
      case 'freemium': return 'text-blue-500';
      case 'paid': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Choose Your Integrations</h2>
        <p className="text-gray-400">
          Select the services you want to integrate into your application
          {maxSelections && ` (${selectedIntegrations.length}/${maxSelections} selected)`}
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(category => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                size="sm"
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category.id)}
                className="whitespace-nowrap"
              >
                <Icon className="h-3 w-3 mr-1" />
                {category.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Selected Summary */}
      {selectedIntegrations.length > 0 && (
        <Card className="p-4 bg-blue-950/20 border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-blue-300">
              {selectedIntegrations.length} integration{selectedIntegrations.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIntegrations.map(id => {
              const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === id);
              return integration ? (
                <Badge key={id} variant="secondary" className="bg-blue-900/50 text-blue-300">
                  {integration.name}
                </Badge>
              ) : null;
            })}
          </div>
        </Card>
      )}

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIntegrations.map(integration => {
          const Icon = integration.icon;
          const isSelected = selectedIntegrations.includes(integration.id);
          const isMaxReached = maxSelections && selectedIntegrations.length >= maxSelections && !isSelected;

          return (
            <Card 
              key={integration.id} 
              className={`p-6 transition-all cursor-pointer ${
                isSelected 
                  ? 'border-blue-500 bg-blue-950/20' 
                  : isMaxReached 
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-gray-600'
              }`}
              onClick={() => !isMaxReached && handleToggleIntegration(integration.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-500/20' : 'bg-gray-900'}`}>
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {integration.name}
                      {isSelected && <Check className="h-4 w-4 text-blue-500" />}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getDifficultyColor(integration.difficulty)}`}
                      >
                        {integration.difficulty}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getPricingColor(integration.pricing)}`}
                      >
                        {integration.pricing}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{integration.popularity}%</span>
                  <Switch
                    checked={isSelected}
                    onCheckedChange={() => !isMaxReached && handleToggleIntegration(integration.id)}
                    disabled={!!isMaxReached}
                  />
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4">{integration.description}</p>

              <div className="space-y-3">
                {/* Features */}
                <div>
                  <p className="text-xs font-medium text-gray-300 mb-1">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {integration.features.slice(0, 3).map(feature => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {integration.features.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{integration.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Quick Info */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-3">
                    <span>{integration.packages.length} packages</span>
                    <span>{integration.envVars.length} env vars</span>
                    {integration.webhooks && <span>{integration.webhooks.length} webhooks</span>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetails(integration.id);
                    }}
                  >
                    <Info className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <Zap className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No integrations found</h3>
          <p className="text-gray-500">Try adjusting your search or category filter</p>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {(() => {
              const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === showDetails);
              if (!integration) return null;

              const Icon = integration.icon;

              return (
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gray-900 rounded-lg">
                        <Icon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{integration.name}</h2>
                        <p className="text-gray-400">{integration.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setShowDetails(null)}>
                      ×
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Features</h3>
                      <div className="flex flex-wrap gap-2">
                        {integration.features.map(feature => (
                          <Badge key={feature} variant="outline">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Required Environment Variables</h3>
                      <div className="bg-gray-900 p-3 rounded-lg">
                        <code className="text-sm">
                          {integration.envVars.map(envVar => (
                            <div key={envVar}>{envVar}=your_value_here</div>
                          ))}
                        </code>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">NPM Packages</h3>
                      <div className="bg-gray-900 p-3 rounded-lg">
                        <code className="text-sm">
                          npm install {integration.packages.join(' ')}
                        </code>
                      </div>
                    </div>

                    {integration.webhooks && (
                      <div>
                        <h3 className="font-medium mb-2">Webhook Events</h3>
                        <div className="space-y-1">
                          {integration.webhooks.map(webhook => (
                            <Badge key={webhook} variant="secondary">
                              <Webhook className="h-3 w-3 mr-1" />
                              {webhook}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-4">
                      <a
                        href={integration.documentation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Documentation
                      </a>
                      <Badge variant="outline" className={getPricingColor(integration.pricing)}>
                        {integration.pricing}
                      </Badge>
                      <Badge variant="outline" className={getDifficultyColor(integration.difficulty)}>
                        {integration.difficulty}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
}