"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Network,
  GitBranch,
  Link,
  Unlink,
  Plus,
  Edit,
  Trash2,
  Settings,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Target,
  Activity,
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Layers,
  TrendingUp,
  BarChart3,
  Shuffle,
  Brain,
  Timer,
  Users,
  Bell,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  ruleName: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'firing' | 'acknowledged' | 'resolved';
  startedAt: Date;
  source: string;
  tags: Record<string, string>;
}

interface CorrelationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    timeWindow: number; // minutes
    minAlerts: number;
    maxAlerts?: number;
    alertRules: string[];
    tagMatches: Record<string, string[]>;
    severities: string[];
  };
  actions: {
    createIncident: boolean;
    suppressAlerts: boolean;
    mergeAlerts: boolean;
    notifyChannels: string[];
    addTags: Record<string, string>;
  };
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  matchedAlerts: number;
  avgCorrelationTime: number; // seconds
}

interface CorrelatedGroup {
  id: string;
  ruleId: string;
  ruleName: string;
  alerts: Alert[];
  createdAt: Date;
  status: 'active' | 'resolved' | 'acknowledged';
  incidentId?: string;
  rootCause?: string;
  tags: Record<string, string>;
}

interface AlertCorrelationProps {
  alerts: Alert[];
  onCreateCorrelationRule: (rule: Partial<CorrelationRule>) => void;
}

export function AlertCorrelation({ alerts, onCreateCorrelationRule }: AlertCorrelationProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<'rules' | 'groups' | 'insights'>('rules');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Mock correlation rules
  const correlationRules: CorrelationRule[] = [
    {
      id: 'rule-001',
      name: 'High CPU with Memory Pressure',
      description: 'Correlate high CPU usage with memory pressure alerts from the same instance',
      enabled: true,
      conditions: {
        timeWindow: 10,
        minAlerts: 2,
        maxAlerts: 5,
        alertRules: ['High CPU Usage', 'Memory Usage High'],
        tagMatches: {
          instance: ['*']
        },
        severities: ['critical', 'high']
      },
      actions: {
        createIncident: true,
        suppressAlerts: false,
        mergeAlerts: true,
        notifyChannels: ['slack-ops'],
        addTags: {
          correlation: 'cpu-memory',
          priority: 'high'
        }
      },
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
      triggerCount: 23,
      matchedAlerts: 89,
      avgCorrelationTime: 45
    },
    {
      id: 'rule-002',
      name: 'Service Dependency Cascade',
      description: 'Detect cascading failures across dependent services',
      enabled: true,
      conditions: {
        timeWindow: 5,
        minAlerts: 3,
        alertRules: ['Service Down', 'Service Degraded', 'Connection Timeout'],
        tagMatches: {
          environment: ['production']
        },
        severities: ['critical', 'high', 'medium']
      },
      actions: {
        createIncident: true,
        suppressAlerts: true,
        mergeAlerts: true,
        notifyChannels: ['pagerduty', 'slack-ops'],
        addTags: {
          correlation: 'cascade-failure',
          impact: 'service-outage'
        }
      },
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 6 * 60 * 60 * 1000),
      triggerCount: 15,
      matchedAlerts: 67,
      avgCorrelationTime: 32
    },
    {
      id: 'rule-003',
      name: 'Database Connection Storm',
      description: 'Identify database connection pool exhaustion across multiple services',
      enabled: true,
      conditions: {
        timeWindow: 3,
        minAlerts: 4,
        alertRules: ['Database Connection Pool Full', 'Database Slow Query'],
        tagMatches: {
          database: ['turso', 'postgresql']
        },
        severities: ['high', 'medium']
      },
      actions: {
        createIncident: false,
        suppressAlerts: false,
        mergeAlerts: true,
        notifyChannels: ['slack-db'],
        addTags: {
          correlation: 'db-connection-storm',
          team: 'database'
        }
      },
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 4 * 60 * 60 * 1000),
      triggerCount: 8,
      matchedAlerts: 34,
      avgCorrelationTime: 28
    },
    {
      id: 'rule-004',
      name: 'Infrastructure Maintenance Window',
      description: 'Group maintenance-related alerts to reduce noise',
      enabled: false,
      conditions: {
        timeWindow: 60,
        minAlerts: 2,
        alertRules: ['*'],
        tagMatches: {
          maintenance: ['true'],
          planned: ['true']
        },
        severities: ['medium', 'low', 'info']
      },
      actions: {
        createIncident: false,
        suppressAlerts: true,
        mergeAlerts: true,
        notifyChannels: [],
        addTags: {
          correlation: 'maintenance',
          suppressed: 'planned-maintenance'
        }
      },
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      triggerCount: 3,
      matchedAlerts: 12,
      avgCorrelationTime: 120
    }
  ];

  // Mock correlated groups
  const correlatedGroups: CorrelatedGroup[] = [
    {
      id: 'group-001',
      ruleId: 'rule-001',
      ruleName: 'High CPU with Memory Pressure',
      alerts: alerts.slice(0, 2),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'active',
      incidentId: 'INC-2024-001',
      rootCause: 'Memory leak in application causing CPU spikes',
      tags: {
        correlation: 'cpu-memory',
        priority: 'high',
        instance: 'k3s-worker-01'
      }
    },
    {
      id: 'group-002',
      ruleId: 'rule-002',
      ruleName: 'Service Dependency Cascade',
      alerts: alerts.slice(1, 4),
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      status: 'resolved',
      incidentId: 'INC-2024-002',
      rootCause: 'Database connection timeout causing service failures',
      tags: {
        correlation: 'cascade-failure',
        impact: 'service-outage',
        environment: 'production'
      }
    },
    {
      id: 'group-003',
      ruleId: 'rule-003',
      ruleName: 'Database Connection Storm',
      alerts: alerts.slice(0, 1),
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'acknowledged',
      tags: {
        correlation: 'db-connection-storm',
        team: 'database',
        database: 'turso'
      }
    }
  ];

  // Filter rules
  const filteredRules = correlationRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'enabled' && rule.enabled) ||
                         (filterStatus === 'disabled' && !rule.enabled);
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'firing':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'acknowledged':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'resolved':
        return 'bg-green-500/20 text-green-400 border-green-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-3 w-3 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'low':
        return <Info className="h-3 w-3 text-blue-500" />;
      default:
        return <Info className="h-3 w-3 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1">
            <Button
              variant={activeTab === 'rules' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('rules')}
            >
              <Settings className="h-4 w-4 mr-1" />
              Rules
            </Button>
            <Button
              variant={activeTab === 'groups' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('groups')}
            >
              <Network className="h-4 w-4 mr-1" />
              Groups
            </Button>
            <Button
              variant={activeTab === 'insights' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('insights')}
            >
              <Brain className="h-4 w-4 mr-1" />
              Insights
            </Button>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Search correlation rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          {activeTab === 'rules' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
            >
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          )}
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
            <Network className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{correlationRules.length}</p>
              <p className="text-sm text-gray-400">Correlation Rules</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{correlatedGroups.filter(g => g.status === 'active').length}</p>
              <p className="text-sm text-gray-400">Active Groups</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Link className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">
                {correlationRules.reduce((sum, r) => sum + r.matchedAlerts, 0)}
              </p>
              <p className="text-sm text-gray-400">Alerts Correlated</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Timer className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">
                {Math.round(correlationRules.reduce((sum, r) => sum + r.avgCorrelationTime, 0) / correlationRules.length)}s
              </p>
              <p className="text-sm text-gray-400">Avg Correlation Time</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Content */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Correlation Rules</h2>
          {filteredRules.map(rule => (
            <Card key={rule.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-2">
                    {rule.enabled ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-500" />
                    )}
                    <Network className="h-5 w-5 text-blue-500" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{rule.name}</h3>
                      <Badge variant={rule.enabled ? "default" : "secondary"}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline">
                        {rule.conditions.minAlerts}+ alerts
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-3">{rule.description}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {rule.triggerCount} triggers
                      </span>
                      <span className="flex items-center gap-1">
                        <Link className="h-3 w-3" />
                        {rule.matchedAlerts} alerts matched
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        ~{rule.avgCorrelationTime}s avg time
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {rule.conditions.timeWindow}m window
                      </span>
                      {rule.lastTriggered && (
                        <span className="flex items-center gap-1">
                          <Bell className="h-3 w-3" />
                          {formatDistanceToNow(rule.lastTriggered, { addSuffix: true })}
                        </span>
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
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRule === rule.id && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Conditions</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Time Window:</span>
                          <span>{rule.conditions.timeWindow} minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Min Alerts:</span>
                          <span>{rule.conditions.minAlerts}</span>
                        </div>
                        {rule.conditions.maxAlerts && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Max Alerts:</span>
                            <span>{rule.conditions.maxAlerts}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">Alert Rules:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.conditions.alertRules.map(ruleName => (
                              <Badge key={ruleName} variant="secondary" className="text-xs">
                                {ruleName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Severities:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.conditions.severities.map(severity => (
                              <Badge key={severity} variant="outline" className="text-xs">
                                {getSeverityIcon(severity)}
                                <span className="ml-1">{severity}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Actions</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className={`h-4 w-4 ${rule.actions.createIncident ? 'text-green-500' : 'text-gray-500'}`} />
                          <span>Create Incident</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <EyeOff className={`h-4 w-4 ${rule.actions.suppressAlerts ? 'text-green-500' : 'text-gray-500'}`} />
                          <span>Suppress Alerts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link className={`h-4 w-4 ${rule.actions.mergeAlerts ? 'text-green-500' : 'text-gray-500'}`} />
                          <span>Merge Alerts</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Notify Channels:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.actions.notifyChannels.map(channel => (
                              <Badge key={channel} variant="secondary" className="text-xs">
                                {channel}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Add Tags:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(rule.actions.addTags).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 pt-3 border-t border-gray-800">
                    Created {formatDistanceToNow(rule.createdAt, { addSuffix: true })} • 
                    Updated {formatDistanceToNow(rule.updatedAt, { addSuffix: true })}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Correlated Alert Groups</h2>
          {correlatedGroups.map(group => (
            <Card key={group.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <Layers className="h-5 w-5 text-purple-500 mt-1" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{group.ruleName}</h3>
                      <Badge variant="outline" className={getStatusColor(group.status)}>
                        {group.status}
                      </Badge>
                      <Badge variant="secondary">
                        {group.alerts.length} alerts
                      </Badge>
                      {group.incidentId && (
                        <Badge variant="outline">
                          {group.incidentId}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(group.createdAt, { addSuffix: true })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {group.alerts.length} correlated alerts
                      </span>
                    </div>

                    {group.rootCause && (
                      <p className="text-sm text-gray-300 mb-3">
                        <strong>Root Cause:</strong> {group.rootCause}
                      </p>
                    )}
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(group.tags).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  >
                    {expandedGroup === group.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Alerts
                  </Button>
                </div>
              </div>

              {/* Expanded Alert List */}
              {expandedGroup === group.id && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
                  <h4 className="font-medium mb-3">Correlated Alerts</h4>
                  <div className="space-y-2">
                    {group.alerts.map(alert => (
                      <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getSeverityIcon(alert.severity)}
                          <div>
                            <p className="font-medium text-sm">{alert.ruleName}</p>
                            <p className="text-xs text-gray-400">{alert.message}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={getStatusColor(alert.status)}>
                            {alert.status}
                          </Badge>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(alert.startedAt, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Correlation Insights</h2>
          
          {/* Performance Metrics */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Performance Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-2">Total Correlations</p>
                <p className="text-2xl font-bold">
                  {correlationRules.reduce((sum, r) => sum + r.triggerCount, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Avg Response Time</p>
                <p className="text-2xl font-bold">
                  {Math.round(correlationRules.reduce((sum, r) => sum + r.avgCorrelationTime, 0) / correlationRules.length)}s
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Noise Reduction</p>
                <p className="text-2xl font-bold text-green-400">72%</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Active Rules</p>
                <p className="text-2xl font-bold">
                  {correlationRules.filter(r => r.enabled).length}
                </p>
              </div>
            </div>
          </Card>

          {/* Top Performing Rules */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Top Performing Rules
            </h3>
            <div className="space-y-3">
              {correlationRules
                .sort((a, b) => b.matchedAlerts - a.matchedAlerts)
                .slice(0, 3)
                .map((rule, index) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-gray-400">{rule.matchedAlerts} alerts correlated</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{rule.triggerCount} triggers</p>
                      <p className="text-sm text-gray-400">~{rule.avgCorrelationTime}s avg</p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* Recommendations */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Recommendations
            </h3>
            <div className="space-y-3">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-blue-500 mt-1" />
                  <div>
                    <h4 className="font-medium mb-1">Create Memory Leak Detection Rule</h4>
                    <p className="text-sm text-gray-400">
                      We detected 15 instances where high CPU and memory alerts occurred together. 
                      Consider creating a correlation rule to identify potential memory leaks.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-1" />
                  <div>
                    <h4 className="font-medium mb-1">Optimize Time Windows</h4>
                    <p className="text-sm text-gray-400">
                      Some rules have overlapping time windows. Consider adjusting the &quot;Infrastructure Maintenance&quot; 
                      rule window from 60m to 30m for better precision.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}