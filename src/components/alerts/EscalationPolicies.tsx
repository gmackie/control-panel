"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { 
  Users,
  Clock,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Settings,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bell,
  Target,
  Activity,
  Timer,
  UserCheck,
  Mail,
  MessageSquare,
  Webhook,
  Slack,
  Phone,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Zap,
  Shield,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EscalationStep {
  id: string;
  order: number;
  type: 'user' | 'group' | 'channel';
  target: string;
  targetName: string;
  delay: number; // minutes
  timeout: number; // minutes
  skipConditions?: string[];
}

interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  steps: EscalationStep[];
  conditions: {
    severity: string[];
    tags: Record<string, string>;
    timeWindows?: string[];
  };
  repeatPolicy?: {
    enabled: boolean;
    maxRepeats: number;
    intervalMinutes: number;
  };
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  successRate: number;
  averageResponseTime: number; // minutes
}

interface EscalationPoliciesProps {
  onCreatePolicy: (policy: Partial<EscalationPolicy>) => void;
}

export function EscalationPolicies({ onCreatePolicy }: EscalationPoliciesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Mock escalation policies data
  const escalationPolicies: EscalationPolicy[] = [
    {
      id: 'policy-001',
      name: 'Critical Infrastructure Escalation',
      description: 'Escalation policy for critical infrastructure alerts',
      enabled: true,
      steps: [
        {
          id: 'step-001',
          order: 1,
          type: 'user',
          target: 'oncall-engineer',
          targetName: 'On-Call Engineer',
          delay: 0,
          timeout: 10
        },
        {
          id: 'step-002',
          order: 2,
          type: 'group',
          target: 'ops-team',
          targetName: 'Operations Team',
          delay: 10,
          timeout: 15
        },
        {
          id: 'step-003',
          order: 3,
          type: 'user',
          target: 'ops-manager',
          targetName: 'Operations Manager',
          delay: 25,
          timeout: 20
        },
        {
          id: 'step-004',
          order: 4,
          type: 'channel',
          target: 'pagerduty-incident',
          targetName: 'PagerDuty Incident',
          delay: 45,
          timeout: 0
        }
      ],
      conditions: {
        severity: ['critical'],
        tags: { team: 'infrastructure' },
        timeWindows: ['business-hours', 'after-hours']
      },
      repeatPolicy: {
        enabled: true,
        maxRepeats: 3,
        intervalMinutes: 60
      },
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 3 * 60 * 60 * 1000),
      triggerCount: 23,
      successRate: 87.0,
      averageResponseTime: 8.5
    },
    {
      id: 'policy-002',
      name: 'Database Performance Escalation',
      description: 'Specialized escalation for database performance issues',
      enabled: true,
      steps: [
        {
          id: 'step-005',
          order: 1,
          type: 'group',
          target: 'database-team',
          targetName: 'Database Team',
          delay: 0,
          timeout: 15
        },
        {
          id: 'step-006',
          order: 2,
          type: 'user',
          target: 'senior-dba',
          targetName: 'Senior DBA',
          delay: 15,
          timeout: 20
        },
        {
          id: 'step-007',
          order: 3,
          type: 'channel',
          target: 'slack-db-alerts',
          targetName: 'Slack #db-alerts',
          delay: 35,
          timeout: 0
        }
      ],
      conditions: {
        severity: ['high', 'medium'],
        tags: { service: 'database' }
      },
      repeatPolicy: {
        enabled: false,
        maxRepeats: 1,
        intervalMinutes: 30
      },
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 12 * 60 * 60 * 1000),
      triggerCount: 15,
      successRate: 93.3,
      averageResponseTime: 12.8
    },
    {
      id: 'policy-003',
      name: 'Security Incident Escalation',
      description: 'High-priority escalation for security-related alerts',
      enabled: true,
      steps: [
        {
          id: 'step-008',
          order: 1,
          type: 'user',
          target: 'security-lead',
          targetName: 'Security Lead',
          delay: 0,
          timeout: 5
        },
        {
          id: 'step-009',
          order: 2,
          type: 'group',
          target: 'security-team',
          targetName: 'Security Team',
          delay: 5,
          timeout: 10
        },
        {
          id: 'step-010',
          order: 3,
          type: 'user',
          target: 'ciso',
          targetName: 'CISO',
          delay: 15,
          timeout: 15
        }
      ],
      conditions: {
        severity: ['critical', 'high'],
        tags: { category: 'security' }
      },
      repeatPolicy: {
        enabled: true,
        maxRepeats: 5,
        intervalMinutes: 30
      },
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      triggerCount: 7,
      successRate: 100.0,
      averageResponseTime: 3.2
    },
    {
      id: 'policy-004',
      name: 'Development Team Escalation',
      description: 'Standard escalation for development team alerts',
      enabled: false,
      steps: [
        {
          id: 'step-011',
          order: 1,
          type: 'channel',
          target: 'slack-dev-alerts',
          targetName: 'Slack #dev-alerts',
          delay: 0,
          timeout: 0
        },
        {
          id: 'step-012',
          order: 2,
          type: 'group',
          target: 'dev-team',
          targetName: 'Development Team',
          delay: 30,
          timeout: 20
        }
      ],
      conditions: {
        severity: ['medium', 'low'],
        tags: { team: 'development' }
      },
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      lastTriggered: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      triggerCount: 42,
      successRate: 78.6,
      averageResponseTime: 25.4
    }
  ];

  // Filter policies
  const filteredPolicies = escalationPolicies.filter(policy => {
    const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'enabled' && policy.enabled) ||
                         (filterStatus === 'disabled' && !policy.enabled);
    
    return matchesSearch && matchesStatus;
  });

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <UserCheck className="h-4 w-4 text-blue-500" />;
      case 'group':
        return <Users className="h-4 w-4 text-green-500" />;
      case 'channel':
        return <Bell className="h-4 w-4 text-purple-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400';
    if (rate >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return 'Immediate';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTotalEscalationTime = (steps: EscalationStep[]) => {
    return steps.reduce((total, step) => total + step.delay + step.timeout, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Search escalation policies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
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
          Create Policy
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{escalationPolicies.length}</p>
              <p className="text-sm text-gray-400">Total Policies</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{escalationPolicies.filter(p => p.enabled).length}</p>
              <p className="text-sm text-gray-400">Active</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">
                {escalationPolicies.reduce((sum, p) => sum + p.triggerCount, 0)}
              </p>
              <p className="text-sm text-gray-400">Total Triggers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">
                {(escalationPolicies.reduce((sum, p) => sum + p.successRate, 0) / escalationPolicies.length).toFixed(1)}%
              </p>
              <p className="text-sm text-gray-400">Avg Success</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Policies List */}
      <div className="space-y-4">
        {filteredPolicies.map(policy => (
          <Card key={policy.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2">
                  {policy.enabled ? (
                    <PlayCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <PauseCircle className="h-5 w-5 text-gray-500" />
                  )}
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{policy.name}</h3>
                    <Badge variant={policy.enabled ? "default" : "secondary"}>
                      {policy.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Badge variant="outline">
                      {policy.steps.length} steps
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-3">{policy.description}</p>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {policy.triggerCount} triggers
                    </span>
                    <span className={`flex items-center gap-1 ${getSuccessRateColor(policy.successRate)}`}>
                      <Target className="h-3 w-3" />
                      {policy.successRate}% success
                    </span>
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      ~{policy.averageResponseTime}m avg response
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(getTotalEscalationTime(policy.steps))} total
                    </span>
                    {policy.lastTriggered && (
                      <span className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        {formatDistanceToNow(policy.lastTriggered, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedPolicy(expandedPolicy === policy.id ? null : policy.id)}
                >
                  {expandedPolicy === policy.id ? (
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

            {/* Escalation Steps Preview */}
            <div className="mb-4">
              <h4 className="font-medium mb-3 text-sm">Escalation Steps</h4>
              <div className="flex items-center gap-2 overflow-x-auto">
                {policy.steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-2 rounded-lg whitespace-nowrap">
                      {getStepIcon(step.type)}
                      <div>
                        <p className="text-sm font-medium">{step.targetName}</p>
                        <p className="text-xs text-gray-400">
                          {step.delay > 0 ? `+${formatDuration(step.delay)}` : 'Immediate'}
                          {step.timeout > 0 && ` (${formatDuration(step.timeout)} timeout)`}
                        </p>
                      </div>
                    </div>
                    {index < policy.steps.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Condition Tags */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400">Conditions:</span>
              {policy.conditions.severity.map(severity => (
                <Badge key={severity} variant="outline" className="text-xs">
                  {severity}
                </Badge>
              ))}
              {Object.entries(policy.conditions.tags).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {value}
                </Badge>
              ))}
              {policy.repeatPolicy?.enabled && (
                <Badge variant="outline" className="text-xs">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Repeats {policy.repeatPolicy.maxRepeats}x
                </Badge>
              )}
            </div>

            {/* Expanded Details */}
            {expandedPolicy === policy.id && (
              <div className="mt-4 p-4 bg-gray-900/50 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium mb-3">Detailed Steps</h4>
                  <div className="space-y-3">
                    {policy.steps.map((step, index) => (
                      <div key={step.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded-full text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStepIcon(step.type)}
                            <h5 className="font-medium">{step.targetName}</h5>
                            <Badge variant="outline" className="text-xs capitalize">
                              {step.type}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                            <div>
                              <span>Delay: </span>
                              <span>{formatDuration(step.delay)}</span>
                            </div>
                            <div>
                              <span>Timeout: </span>
                              <span>{step.timeout > 0 ? formatDuration(step.timeout) : 'None'}</span>
                            </div>
                          </div>
                          {step.skipConditions && step.skipConditions.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-gray-400">Skip if: </span>
                              {step.skipConditions.map(condition => (
                                <Badge key={condition} variant="secondary" className="text-xs ml-1">
                                  {condition}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {policy.repeatPolicy?.enabled && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Repeat Policy
                    </h4>
                    <div className="bg-gray-800/50 p-3 rounded-lg text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-gray-400">Max repeats: </span>
                          <span>{policy.repeatPolicy.maxRepeats}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Interval: </span>
                          <span>{formatDuration(policy.repeatPolicy.intervalMinutes)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Performance Metrics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Success Rate</p>
                      <div className="flex items-center gap-2">
                        <Progress value={policy.successRate} className="h-2 flex-1" />
                        <span className={`text-sm font-medium ${getSuccessRateColor(policy.successRate)}`}>
                          {policy.successRate}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Avg Response Time</p>
                      <p className="text-lg font-semibold">{policy.averageResponseTime}m</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Total Triggers</p>
                      <p className="text-lg font-semibold">{policy.triggerCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Last Triggered</p>
                      <p className="text-sm">
                        {policy.lastTriggered 
                          ? formatDistanceToNow(policy.lastTriggered, { addSuffix: true })
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-400 pt-3 border-t border-gray-800">
                  Created {formatDistanceToNow(policy.createdAt, { addSuffix: true })} • 
                  Updated {formatDistanceToNow(policy.updatedAt, { addSuffix: true })}
                </div>
              </div>
            )}
          </Card>
        ))}

        {filteredPolicies.length === 0 && (
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Escalation Policies Found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterStatus !== 'all'
                ? "Try adjusting your search or filters"
                : "Get started by creating your first escalation policy"}
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Policy
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}