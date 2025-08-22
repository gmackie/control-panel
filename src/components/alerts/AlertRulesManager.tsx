"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Toggle,
  Settings,
  Search,
  Filter,
  Eye,
  EyeOff,
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  Target,
  Code,
  Mail,
  MessageSquare,
  Webhook,
  Slack,
  Users,
  ChevronDown,
  ChevronRight,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AlertRule {
  id: string;
  name: string;
  description: string;
  query: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  threshold: number;
  duration: string;
  enabled: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  notificationChannels: string[];
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  evaluationInterval: string;
  group: string;
  runbookUrl?: string;
  silenceConditions?: string[];
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

interface AlertRulesManagerProps {
  rules: AlertRule[];
  channels: NotificationChannel[];
  onCreateRule: (rule: Partial<AlertRule>) => void;
  onUpdateRule: (ruleId: string, updates: Partial<AlertRule>) => void;
  onDeleteRule: (ruleId: string) => void;
}

export function AlertRulesManager({ 
  rules, 
  channels, 
  onCreateRule, 
  onUpdateRule, 
  onDeleteRule 
}: AlertRulesManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Enhanced mock data with more realistic alert rules
  const enhancedRules: AlertRule[] = [
    {
      id: 'rule-001',
      name: 'High CPU Usage',
      description: 'Alert when CPU usage exceeds 90% for 5 minutes',
      query: 'avg(rate(cpu_usage_seconds_total[5m])) by (instance) * 100 > 90',
      severity: 'critical',
      threshold: 90,
      duration: '5m',
      enabled: true,
      labels: { team: 'infrastructure', service: 'compute' },
      annotations: { 
        summary: 'High CPU usage detected on {{ $labels.instance }}',
        description: 'CPU usage is {{ $value }}% on {{ $labels.instance }} for more than 5 minutes'
      },
      notificationChannels: ['email-ops', 'slack-alerts'],
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
      triggerCount: 15,
      evaluationInterval: '1m',
      group: 'infrastructure',
      runbookUrl: 'https://runbooks.gmac.io/high-cpu',
      silenceConditions: ['maintenance_mode == "true"']
    },
    {
      id: 'rule-002',
      name: 'Service Down',
      description: 'Alert when a service becomes unavailable',
      query: 'up{job!="blackbox"} == 0',
      severity: 'high',
      threshold: 0,
      duration: '1m',
      enabled: true,
      labels: { team: 'platform', service: 'monitoring' },
      annotations: { 
        summary: 'Service {{ $labels.job }} is down',
        description: 'Service {{ $labels.job }} on {{ $labels.instance }} has been down for more than 1 minute'
      },
      notificationChannels: ['email-ops', 'pagerduty'],
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 6 * 60 * 60 * 1000),
      triggerCount: 3,
      evaluationInterval: '30s',
      group: 'availability',
      runbookUrl: 'https://runbooks.gmac.io/service-down'
    },
    {
      id: 'rule-003',
      name: 'Database Connection Pool High',
      description: 'Alert when database connection pool usage is high',
      query: 'db_connection_pool_usage_percent > 85',
      severity: 'medium',
      threshold: 85,
      duration: '3m',
      enabled: false,
      labels: { team: 'backend', service: 'database' },
      annotations: { 
        summary: 'Database connection pool usage is high',
        description: 'Connection pool usage is {{ $value }}% on database {{ $labels.database }}'
      },
      notificationChannels: ['slack-backend'],
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      triggerCount: 0,
      evaluationInterval: '1m',
      group: 'database'
    },
    {
      id: 'rule-004',
      name: 'API Rate Limit Approaching',
      description: 'Alert when API rate limit usage exceeds 80%',
      query: 'api_rate_limit_usage_percent > 80',
      severity: 'low',
      threshold: 80,
      duration: '2m',
      enabled: true,
      labels: { team: 'api', service: 'rate-limiting' },
      annotations: { 
        summary: 'API rate limit usage is high for {{ $labels.api_key }}',
        description: 'Rate limit usage is {{ $value }}% for API key {{ $labels.api_key }}'
      },
      notificationChannels: ['webhook-api'],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 4 * 60 * 60 * 1000),
      triggerCount: 8,
      evaluationInterval: '1m',
      group: 'api'
    }
  ];

  const allRules = rules.length > 0 ? rules : enhancedRules;

  // Filter rules
  const filteredRules = allRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.query.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = filterGroup === 'all' || rule.group === filterGroup;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'enabled' && rule.enabled) ||
                         (filterStatus === 'disabled' && !rule.enabled);
    
    return matchesSearch && matchesGroup && matchesStatus;
  });

  // Get unique groups
  const groups = Array.from(new Set(allRules.map(rule => rule.group)));

  const getSeverityIcon = (severity: AlertRule['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: AlertRule['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'info':
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-3 w-3" />;
      case 'sms':
        return <MessageSquare className="h-3 w-3" />;
      case 'webhook':
        return <Webhook className="h-3 w-3" />;
      case 'slack':
        return <Slack className="h-3 w-3" />;
      case 'pagerduty':
        return <Users className="h-3 w-3" />;
      default:
        return <Settings className="h-3 w-3" />;
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
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
          >
            <option value="all">All Groups</option>
            {groups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
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
          Create Rule
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{allRules.length}</p>
              <p className="text-sm text-gray-400">Total Rules</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{allRules.filter(r => r.enabled).length}</p>
              <p className="text-sm text-gray-400">Enabled</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{allRules.filter(r => r.severity === 'critical').length}</p>
              <p className="text-sm text-gray-400">Critical</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">
                {allRules.filter(r => r.lastTriggered && (Date.now() - r.lastTriggered.getTime()) < 24 * 60 * 60 * 1000).length}
              </p>
              <p className="text-sm text-gray-400">Triggered 24h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {filteredRules.map(rule => (
          <Card key={rule.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2">
                  {rule.enabled ? (
                    <Play className="h-4 w-4 text-green-500" />
                  ) : (
                    <Pause className="h-4 w-4 text-gray-500" />
                  )}
                  {getSeverityIcon(rule.severity)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{rule.name}</h3>
                    <Badge variant="outline" className={getSeverityColor(rule.severity)}>
                      {rule.severity}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {rule.group}
                    </Badge>
                    <Badge variant={rule.enabled ? "default" : "secondary"}>
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-3">{rule.description}</p>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span>Threshold: {rule.threshold}{rule.severity === 'critical' || rule.severity === 'high' ? '%' : ''}</span>
                    <span>Duration: {rule.duration}</span>
                    <span>Interval: {rule.evaluationInterval}</span>
                    <span>Triggers: {rule.triggerCount}</span>
                    {rule.lastTriggered && (
                      <span>Last: {formatDistanceToNow(rule.lastTriggered, { addSuffix: true })}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                >
                  {expandedRule === rule.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Details
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateRule(rule.id, { enabled: !rule.enabled })}
                >
                  {rule.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDeleteRule(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Notification Channels */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400">Notifications:</span>
              {rule.notificationChannels.map(channelId => {
                const channel = channels.find(c => c.id === channelId);
                return (
                  <Badge key={channelId} variant="outline" className="text-xs">
                    {channel && getChannelIcon(channel.type)}
                    <span className="ml-1">{channel?.name || channelId}</span>
                  </Badge>
                );
              })}
            </div>

            {/* Expanded Details */}
            {expandedRule === rule.id && (
              <div className="mt-4 p-4 bg-gray-900/50 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Query Expression
                  </h4>
                  <div className="bg-gray-800 p-3 rounded-md font-mono text-sm overflow-x-auto">
                    {rule.query}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Labels</h4>
                    <div className="space-y-1">
                      {Object.entries(rule.labels).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className="text-xs">
                            {key}: {value}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Annotations</h4>
                    <div className="space-y-1">
                      {Object.entries(rule.annotations).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="text-gray-400">{key}:</span>
                          <span className="ml-2">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {rule.runbookUrl && (
                  <div>
                    <h4 className="font-medium mb-2">Runbook</h4>
                    <a 
                      href={rule.runbookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      {rule.runbookUrl}
                    </a>
                  </div>
                )}

                {rule.silenceConditions && rule.silenceConditions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Silence Conditions</h4>
                    <div className="space-y-1">
                      {rule.silenceConditions.map((condition, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 pt-2 border-t border-gray-800">
                  Created {formatDistanceToNow(rule.createdAt, { addSuffix: true })} • 
                  Updated {formatDistanceToNow(rule.updatedAt, { addSuffix: true })}
                </div>
              </div>
            )}
          </Card>
        ))}

        {filteredRules.length === 0 && (
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Rules Found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterGroup !== 'all' || filterStatus !== 'all'
                ? "Try adjusting your search or filters"
                : "Get started by creating your first alert rule"}
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}