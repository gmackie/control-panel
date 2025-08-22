"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Webhook,
  Plus,
  Settings,
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Shield,
  Zap,
  Globe,
  Server,
  Database,
  CreditCard,
  Mail,
  MessageSquare,
  Mic,
  Brain,
} from "lucide-react";
import Link from "next/link";

interface WebhookEndpoint {
  id: string;
  applicationId: string;
  provider: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  created: string;
  lastTriggered?: string;
  status: 'active' | 'failed' | 'disabled';
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    avgResponseTime: number;
  };
  metadata?: {
    description?: string;
    tags?: string[];
  };
}

interface WebhookEvent {
  id: string;
  webhookId: string;
  provider: string;
  eventType: string;
  payload: any;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  attempts: number;
  responseCode?: number;
  responseTime?: number;
  errorMessage?: string;
  timestamp: string;
  nextRetry?: string;
}

interface WebhookStats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalEvents: number;
  successRate: number;
  avgResponseTime: number;
  topProviders: Array<{
    provider: string;
    count: number;
    successRate: number;
  }>;
}

export default function WebhooksPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'endpoints' | 'events' | 'logs'>('endpoints');

  const { data: webhookData, isLoading, refetch } = useQuery<{
    endpoints: WebhookEndpoint[];
    recentEvents: WebhookEvent[];
    stats: WebhookStats;
  }>({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const response = await fetch("/api/webhooks");
      if (!response.ok) throw new Error("Failed to fetch webhook data");
      return response.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (webhook: Partial<WebhookEndpoint>) => {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhook),
      });
      if (!response.ok) throw new Error("Failed to create webhook");
      return response.json();
    },
    onSuccess: () => {
      setShowCreateForm(false);
      refetch();
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WebhookEndpoint> & { id: string }) => {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update webhook");
      return response.json();
    },
    onSuccess: () => refetch(),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete webhook");
      return response.json();
    },
    onSuccess: () => refetch(),
  });

  const getProviderIcon = (provider: string) => {
    const icons: Record<string, any> = {
      stripe: CreditCard,
      sendgrid: Mail,
      twilio: MessageSquare,
      elevenlabs: Mic,
      openrouter: Brain,
      github: Globe,
      discord: MessageSquare,
      slack: MessageSquare,
    };
    return icons[provider] || Webhook;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'pending':
      case 'retrying':
        return 'text-yellow-500';
      case 'disabled':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'pending':
      case 'retrying':
        return 'warning';
      case 'disabled':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const filteredEndpoints = webhookData?.endpoints.filter(endpoint => {
    const matchesProvider = filterProvider === 'all' || endpoint.provider === filterProvider;
    const matchesStatus = filterStatus === 'all' || endpoint.status === filterStatus;
    const matchesSearch = searchQuery === '' || 
      endpoint.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.events.some(event => event.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesProvider && matchesStatus && matchesSearch;
  }) || [];

  const providers = Array.from(new Set(webhookData?.endpoints.map(e => e.provider) || []));

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Management</h1>
          <p className="text-gray-400">
            Manage webhook endpoints and monitor event deliveries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Endpoints</p>
              <p className="text-2xl font-bold">{webhookData?.stats.totalEndpoints || 0}</p>
            </div>
            <Webhook className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Endpoints</p>
              <p className="text-2xl font-bold">{webhookData?.stats.activeEndpoints || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold">
                {webhookData?.stats.successRate ? `${webhookData.stats.successRate.toFixed(1)}%` : '0%'}
              </p>
            </div>
            <Activity className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Response</p>
              <p className="text-2xl font-bold">
                {webhookData?.stats.avgResponseTime ? `${webhookData.stats.avgResponseTime}ms` : '0ms'}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
        {(['endpoints', 'events', 'logs'] as const).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={selectedTab === tab ? 'default' : 'ghost'}
            onClick={() => setSelectedTab(tab)}
          >
            {tab === 'endpoints' && 'Endpoints'}
            {tab === 'events' && 'Recent Events'}
            {tab === 'logs' && 'Activity Logs'}
          </Button>
        ))}
      </div>

      {/* Filters */}
      {selectedTab === 'endpoints' && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search webhooks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg w-full"
                />
              </div>
            </div>
            
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
            >
              <option value="all">All Providers</option>
              {providers.map(provider => (
                <option key={provider} value={provider}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="failed">Failed</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </Card>
      )}

      {/* Content based on selected tab */}
      {selectedTab === 'endpoints' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-800 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-800 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredEndpoints.length === 0 ? (
            <Card className="p-12 text-center">
              <Webhook className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No webhooks found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || filterProvider !== 'all' || filterStatus !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Create your first webhook endpoint to get started'
                }
              </p>
              {!searchQuery && filterProvider === 'all' && filterStatus === 'all' && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredEndpoints.map((endpoint) => {
                const Icon = getProviderIcon(endpoint.provider);
                const successRate = endpoint.stats.totalDeliveries > 0 
                  ? (endpoint.stats.successfulDeliveries / endpoint.stats.totalDeliveries) * 100 
                  : 0;

                return (
                  <Card key={endpoint.id} className="p-6 hover:border-gray-700 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-900 rounded-lg">
                          <Icon className={`h-6 w-6 ${getStatusColor(endpoint.status)}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{endpoint.provider.charAt(0).toUpperCase() + endpoint.provider.slice(1)}</h3>
                            <Badge variant={getStatusBadge(endpoint.status) as any}>
                              {endpoint.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 font-mono break-all">{endpoint.url}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{endpoint.events.length} events</span>
                            <span>•</span>
                            <span>{endpoint.stats.totalDeliveries} deliveries</span>
                            <span>•</span>
                            <span>{successRate.toFixed(1)}% success</span>
                            {endpoint.lastTriggered && (
                              <>
                                <span>•</span>
                                <span>Last: {new Date(endpoint.lastTriggered).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={endpoint.enabled}
                          onCheckedChange={(enabled) => 
                            updateWebhookMutation.mutate({ id: endpoint.id, enabled })
                          }
                        />
                        <Button size="sm" variant="ghost" onClick={() => setSelectedEndpoint(endpoint.id)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => deleteWebhookMutation.mutate(endpoint.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {endpoint.events.slice(0, 5).map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                      {endpoint.events.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{endpoint.events.length - 5} more
                        </Badge>
                      )}
                    </div>

                    {endpoint.metadata?.description && (
                      <p className="text-sm text-gray-400 mb-3">{endpoint.metadata.description}</p>
                    )}

                    <div className="grid grid-cols-3 gap-4 text-center py-2 bg-gray-900 rounded-lg">
                      <div>
                        <p className="text-lg font-semibold text-green-500">
                          {endpoint.stats.successfulDeliveries}
                        </p>
                        <p className="text-xs text-gray-500">Success</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-red-500">
                          {endpoint.stats.failedDeliveries}
                        </p>
                        <p className="text-xs text-gray-500">Failed</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-blue-500">
                          {endpoint.stats.avgResponseTime}ms
                        </p>
                        <p className="text-xs text-gray-500">Avg Response</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedTab === 'events' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-medium mb-4">Recent Webhook Events</h3>
            <div className="space-y-3">
              {webhookData?.recentEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      event.status === 'success' ? 'bg-green-500' :
                      event.status === 'failed' ? 'bg-red-500' :
                      event.status === 'pending' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`} />
                    <div>
                      <p className="font-medium">{event.eventType}</p>
                      <p className="text-sm text-gray-400">{event.provider}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusBadge(event.status) as any} className="mb-1">
                      {event.status}
                    </Badge>
                    <p className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              )) || (
                <p className="text-center text-gray-500 py-8">No recent events</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {selectedTab === 'logs' && (
        <Card className="p-6">
          <h3 className="font-medium mb-4">Activity Logs</h3>
          <p className="text-center text-gray-500 py-8">
            Activity logs will be displayed here
          </p>
        </Card>
      )}

      {/* Create Webhook Modal would go here */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Create Webhook Endpoint</h2>
              <p className="text-gray-400 mb-6">
                Set up a new webhook endpoint to receive events from integrations
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Provider</label>
                  <select className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg">
                    <option>Select a provider</option>
                    <option value="stripe">Stripe</option>
                    <option value="sendgrid">SendGrid</option>
                    <option value="twilio">Twilio</option>
                    <option value="github">GitHub</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Endpoint URL</label>
                  <input
                    type="url"
                    placeholder="https://your-app.com/webhooks/stripe"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Events to listen for</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-800 rounded-lg">
                    {['payment_intent.succeeded', 'payment_intent.failed', 'charge.succeeded', 'customer.created'].map((event) => (
                      <label key={event} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="rounded" />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description (optional)</label>
                  <input
                    type="text"
                    placeholder="Brief description of this webhook"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}