"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Mail,
  MessageSquare,
  Webhook,
  Slack,
  Users,
  Plus,
  Edit,
  Trash2,
  TestTube,
  Settings,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Bell,
  Globe,
  Phone,
  Shield,
  Key,
  Link,
  Activity,
  Target,
  Zap,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  successRate: number;
  messagesSent: number;
  tags: string[];
  description?: string;
  rateLimits?: {
    maxPerMinute: number;
    maxPerHour: number;
  };
  retryConfig?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

interface NotificationChannelsProps {
  channels: NotificationChannel[];
  onCreateChannel: (channel: Partial<NotificationChannel>) => void;
  onUpdateChannel: (channelId: string, updates: Partial<NotificationChannel>) => void;
  onTestChannel: (channelId: string) => void;
}

export function NotificationChannels({ 
  channels, 
  onCreateChannel, 
  onUpdateChannel, 
  onTestChannel 
}: NotificationChannelsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  // Enhanced mock data with comprehensive notification channels
  const enhancedChannels: NotificationChannel[] = [
    {
      id: 'email-ops',
      name: 'Operations Email',
      type: 'email',
      config: { 
        recipients: ['ops@gmac.io', 'alerts@gmac.io'], 
        smtpServer: 'smtp.gmail.com',
        from: 'alerts@gmac.io',
        subject: '[ALERT] {{ .CommonLabels.alertname }}',
        template: 'html'
      },
      enabled: true,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
      successRate: 98.5,
      messagesSent: 1247,
      tags: ['critical', 'operations'],
      description: 'Primary email channel for operations team alerts',
      rateLimits: {
        maxPerMinute: 10,
        maxPerHour: 100
      },
      retryConfig: {
        maxRetries: 3,
        backoffMultiplier: 2
      }
    },
    {
      id: 'slack-alerts',
      name: 'Slack #alerts',
      type: 'slack',
      config: { 
        webhookUrl: 'https://hooks.slack.com/services/T123/B456/xyz',
        channel: '#alerts',
        username: 'AlertBot',
        iconEmoji: ':warning:',
        color: 'danger'
      },
      enabled: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 15 * 60 * 1000),
      successRate: 99.2,
      messagesSent: 892,
      tags: ['slack', 'real-time'],
      description: 'Real-time alerts to development team Slack channel',
      rateLimits: {
        maxPerMinute: 20,
        maxPerHour: 300
      }
    },
    {
      id: 'webhook-api',
      name: 'Webhook API Integration',
      type: 'webhook',
      config: { 
        url: 'https://api.gmac.io/webhooks/alerts',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ***',
          'Content-Type': 'application/json'
        },
        timeout: 30,
        insecureSkipVerify: false
      },
      enabled: true,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 45 * 60 * 1000),
      successRate: 95.8,
      messagesSent: 543,
      tags: ['webhook', 'api', 'automation'],
      description: 'Webhook for custom alert processing and automation',
      rateLimits: {
        maxPerMinute: 50,
        maxPerHour: 1000
      },
      retryConfig: {
        maxRetries: 5,
        backoffMultiplier: 1.5
      }
    },
    {
      id: 'pagerduty',
      name: 'PagerDuty Escalation',
      type: 'pagerduty',
      config: { 
        serviceKey: 'pd-service-key-123',
        severity: 'critical',
        client: 'GMAC.IO Monitoring',
        clientUrl: 'https://monitor.gmac.io'
      },
      enabled: false,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      successRate: 100.0,
      messagesSent: 23,
      tags: ['pagerduty', 'escalation', 'critical'],
      description: 'PagerDuty integration for critical incident escalation',
      rateLimits: {
        maxPerMinute: 5,
        maxPerHour: 50
      }
    },
    {
      id: 'sms-oncall',
      name: 'On-Call SMS',
      type: 'sms',
      config: { 
        provider: 'twilio',
        accountSid: 'ACxxx',
        authToken: '***',
        fromNumber: '+1234567890',
        recipients: ['+1987654321', '+1555123456']
      },
      enabled: true,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 8 * 60 * 60 * 1000),
      successRate: 97.3,
      messagesSent: 156,
      tags: ['sms', 'urgent', 'on-call'],
      description: 'SMS notifications for urgent alerts to on-call engineers',
      rateLimits: {
        maxPerMinute: 3,
        maxPerHour: 20
      }
    }
  ];

  const allChannels = channels.length > 0 ? channels : enhancedChannels;

  // Filter channels
  const filteredChannels = allChannels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         channel.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         channel.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || channel.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'enabled' && channel.enabled) ||
                         (filterStatus === 'disabled' && !channel.enabled);
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-5 w-5 text-blue-500" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case 'webhook':
        return <Webhook className="h-5 w-5 text-purple-500" />;
      case 'slack':
        return <Slack className="h-5 w-5 text-orange-500" />;
      case 'pagerduty':
        return <Users className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 98) return 'text-green-400';
    if (rate >= 95) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleTestChannel = async (channelId: string) => {
    setTestingChannel(channelId);
    try {
      await onTestChannel(channelId);
      // Simulate test completion
      setTimeout(() => {
        setTestingChannel(null);
      }, 2000);
    } catch (error) {
      setTestingChannel(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value="all">All Types</option>
            <option value="email">Email</option>
            <option value="slack">Slack</option>
            <option value="webhook">Webhook</option>
            <option value="sms">SMS</option>
            <option value="pagerduty">PagerDuty</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{allChannels.length}</p>
              <p className="text-sm text-gray-400">Total Channels</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{allChannels.filter(c => c.enabled).length}</p>
              <p className="text-sm text-gray-400">Active</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Send className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">
                {allChannels.reduce((sum, c) => sum + c.messagesSent, 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-400">Messages Sent</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">
                {(allChannels.reduce((sum, c) => sum + c.successRate, 0) / allChannels.length).toFixed(1)}%
              </p>
              <p className="text-sm text-gray-400">Avg Success Rate</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">
                {allChannels.filter(c => c.lastUsed && (Date.now() - c.lastUsed.getTime()) < 24 * 60 * 60 * 1000).length}
              </p>
              <p className="text-sm text-gray-400">Used 24h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Channels List */}
      <div className="space-y-4">
        {filteredChannels.map(channel => (
          <Card key={channel.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                {getChannelIcon(channel.type)}
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{channel.name}</h3>
                    <Badge variant="outline" className="capitalize">
                      {channel.type}
                    </Badge>
                    <Badge variant={channel.enabled ? "default" : "secondary"}>
                      {channel.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={channel.enabled}
                        onCheckedChange={(enabled) => onUpdateChannel(channel.id, { enabled })}
                      />
                    </div>
                  </div>
                  
                  {channel.description && (
                    <p className="text-sm text-gray-400 mb-3">{channel.description}</p>
                  )}
                  
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      {channel.messagesSent.toLocaleString()} sent
                    </span>
                    <span className={`flex items-center gap-1 ${getSuccessRateColor(channel.successRate)}`}>
                      <Target className="h-3 w-3" />
                      {channel.successRate}% success
                    </span>
                    {channel.lastUsed && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(channel.lastUsed, { addSuffix: true })}
                      </span>
                    )}
                    {channel.rateLimits && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {channel.rateLimits.maxPerMinute}/min
                      </span>
                    )}
                  </div>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {channel.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestChannel(channel.id)}
                  disabled={testingChannel === channel.id}
                >
                  {testingChannel === channel.id ? (
                    <>
                      <Settings className="h-4 w-4 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-1" />
                      Test
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Configuration Preview */}
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuration
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedChannel(expandedChannel === channel.id ? null : channel.id)}
                >
                  {expandedChannel === channel.id ? 'Hide Details' : 'Show Details'}
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {channel.type === 'email' && (
                  <>
                    <div>
                      <span className="text-gray-400">Recipients:</span>
                      <span className="ml-2">{Array.isArray(channel.config.recipients) ? channel.config.recipients.length : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">SMTP:</span>
                      <span className="ml-2">{channel.config.smtpServer}</span>
                    </div>
                  </>
                )}
                
                {channel.type === 'slack' && (
                  <>
                    <div>
                      <span className="text-gray-400">Channel:</span>
                      <span className="ml-2">{channel.config.channel}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Username:</span>
                      <span className="ml-2">{channel.config.username}</span>
                    </div>
                  </>
                )}
                
                {channel.type === 'webhook' && (
                  <>
                    <div>
                      <span className="text-gray-400">Method:</span>
                      <span className="ml-2">{channel.config.method}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Timeout:</span>
                      <span className="ml-2">{channel.config.timeout}s</span>
                    </div>
                  </>
                )}
                
                {channel.type === 'sms' && (
                  <>
                    <div>
                      <span className="text-gray-400">Provider:</span>
                      <span className="ml-2 capitalize">{channel.config.provider}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Recipients:</span>
                      <span className="ml-2">{Array.isArray(channel.config.recipients) ? channel.config.recipients.length : 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Expanded Configuration */}
              {expandedChannel === channel.id && (
                <div className="mt-4 space-y-3 pt-3 border-t border-gray-800">
                  {channel.rateLimits && (
                    <div>
                      <h5 className="font-medium text-xs text-gray-400 mb-2">Rate Limits</h5>
                      <div className="flex items-center gap-4 text-xs">
                        <span>Per minute: {channel.rateLimits.maxPerMinute}</span>
                        <span>Per hour: {channel.rateLimits.maxPerHour}</span>
                      </div>
                    </div>
                  )}

                  {channel.retryConfig && (
                    <div>
                      <h5 className="font-medium text-xs text-gray-400 mb-2">Retry Configuration</h5>
                      <div className="flex items-center gap-4 text-xs">
                        <span>Max retries: {channel.retryConfig.maxRetries}</span>
                        <span>Backoff: {channel.retryConfig.backoffMultiplier}x</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <h5 className="font-medium text-xs text-gray-400 mb-2">Timestamps</h5>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Created: {formatDistanceToNow(channel.createdAt, { addSuffix: true })}</span>
                      <span>Updated: {formatDistanceToNow(channel.updatedAt, { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}

        {filteredChannels.length === 0 && (
          <Card className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Channels Found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                ? "Try adjusting your search or filters"
                : "Get started by adding your first notification channel"}
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}