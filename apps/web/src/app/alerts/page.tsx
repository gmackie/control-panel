"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  Plus,
  Zap,
  Mail,
  MessageSquare,
  Webhook,
  Slack,
  Users,
  TrendingUp,
  Activity,
  RefreshCw,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AlertRulesManager } from "@/components/alerts/AlertRulesManager";
import { NotificationChannels } from "@/components/alerts/NotificationChannels";
import { EscalationPolicies } from "@/components/alerts/EscalationPolicies";
import { AlertCorrelation } from "@/components/alerts/AlertCorrelation";

interface Alert {
  id: string;
  ruleName: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'firing' | 'acknowledged' | 'resolved';
  startedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  source: string;
  tags: Record<string, string>;
  runbookUrl?: string;
  silencedUntil?: Date;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  query: string;
  severity: Alert['severity'];
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
}

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
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlertsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [alertsRes, rulesRes, channelsRes] = await Promise.all([
        fetch('/api/alerts/instances'),
        fetch('/api/alerts/rules'),
        fetch('/api/alerts/channels')
      ]);
      
      const alertsData = await alertsRes.json();
      const rulesData = await rulesRes.json();
      const channelsData = await channelsRes.json();
      
      setAlerts(alertsData.alerts || generateMockAlerts());
      setAlertRules(rulesData.rules || generateMockAlertRules());
      setNotificationChannels(channelsData.channels || generateMockChannels());
    } catch (error) {
      console.error('Error fetching alerts data:', error);
      // Use mock data as fallback
      setAlerts(generateMockAlerts());
      setAlertRules(generateMockAlertRules());
      setNotificationChannels(generateMockChannels());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertsData();
    // Set up real-time updates
    const interval = setInterval(fetchAlertsData, 30000);
    return () => clearInterval(interval);
  }, [fetchAlertsData]);

  const generateMockAlerts = (): Alert[] => {
    const now = new Date();
    return [
      {
        id: 'alert-001',
        ruleName: 'High CPU Usage',
        message: 'CPU usage above 90% for 5 minutes on k3s-worker-01',
        severity: 'critical',
        status: 'firing',
        startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        source: 'prometheus',
        tags: { instance: 'k3s-worker-01', job: 'node-exporter' },
        runbookUrl: 'https://runbooks.gmac.io/high-cpu'
      },
      {
        id: 'alert-002',
        ruleName: 'Service Down',
        message: 'Gitea service is not responding',
        severity: 'high',
        status: 'acknowledged',
        startedAt: new Date(now.getTime() - 45 * 60 * 1000),
        acknowledgedAt: new Date(now.getTime() - 30 * 60 * 1000),
        acknowledgedBy: 'admin@gmac.io',
        source: 'health-check',
        tags: { service: 'gitea', environment: 'production' }
      },
      {
        id: 'alert-003',
        ruleName: 'Database Connection Pool Full',
        message: 'Turso database connection pool at 95% capacity',
        severity: 'medium',
        status: 'firing',
        startedAt: new Date(now.getTime() - 15 * 60 * 1000),
        source: 'application-metrics',
        tags: { database: 'turso', pool: 'main' }
      },
      {
        id: 'alert-004',
        ruleName: 'Certificate Expiring',
        message: 'SSL certificate for *.gmac.io expires in 7 days',
        severity: 'medium',
        status: 'resolved',
        startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        resolvedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        resolvedBy: 'system',
        source: 'certificate-monitor',
        tags: { domain: 'gmac.io', type: 'wildcard' }
      }
    ];
  };

  const generateMockAlertRules = (): AlertRule[] => {
    return [
      {
        id: 'rule-001',
        name: 'High CPU Usage',
        description: 'Alert when CPU usage exceeds 90% for 5 minutes',
        query: 'avg(cpu_usage_percent) > 90',
        severity: 'critical',
        threshold: 90,
        duration: '5m',
        enabled: true,
        labels: { team: 'infrastructure' },
        annotations: { 
          summary: 'High CPU usage detected',
          description: 'CPU usage is {{ $value }}% on {{ $labels.instance }}'
        },
        notificationChannels: ['email-ops', 'slack-alerts'],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        triggerCount: 15,
        lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
        evaluationInterval: '30s',
        group: 'infrastructure'
      },
      {
        id: 'rule-002',
        name: 'Service Down',
        description: 'Alert when a service becomes unavailable',
        query: 'up == 0',
        severity: 'high',
        threshold: 0,
        duration: '1m',
        enabled: true,
        labels: { team: 'platform' },
        annotations: { 
          summary: 'Service is down',
          description: 'Service {{ $labels.job }} on {{ $labels.instance }} is down'
        },
        notificationChannels: ['email-ops', 'pagerduty'],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        triggerCount: 5,
        lastTriggered: new Date(Date.now() - 12 * 60 * 60 * 1000),
        evaluationInterval: '10s',
        group: 'platform'
      }
    ];
  };

  const generateMockChannels = (): NotificationChannel[] => {
    return [
      {
        id: 'email-ops',
        name: 'Operations Email',
        type: 'email',
        config: { recipients: ['ops@gmac.io'], smtp_server: 'smtp.gmail.com' },
        enabled: true,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
        successRate: 98.5,
        messagesSent: 1250,
        tags: ['primary', 'operations']
      },
      {
        id: 'slack-alerts',
        name: 'Slack #alerts',
        type: 'slack',
        config: { webhook_url: 'https://hooks.slack.com/...', channel: '#alerts' },
        enabled: true,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        lastUsed: new Date(Date.now() - 30 * 60 * 1000),
        successRate: 99.9,
        messagesSent: 3420,
        tags: ['instant', 'team']
      },
      {
        id: 'pagerduty',
        name: 'PagerDuty Escalation',
        type: 'pagerduty',
        config: { service_key: 'pd-key-123', severity_mapping: { critical: 'critical', high: 'error' } },
        enabled: false,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        successRate: 100,
        messagesSent: 45,
        tags: ['escalation', 'oncall']
      }
    ];
  };

  // Calculate alert statistics
  const activeAlerts = alerts.filter(a => a.status === 'firing');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');
  const resolvedLast24h = alerts.filter(a => {
    if (a.status !== 'resolved' || !a.resolvedAt) return false;
    return (Date.now() - a.resolvedAt.getTime()) < 24 * 60 * 60 * 1000;
  });

  const alertStats = {
    active: activeAlerts.length,
    critical: activeAlerts.filter(a => a.severity === 'critical').length,
    high: activeAlerts.filter(a => a.severity === 'high').length,
    medium: activeAlerts.filter(a => a.severity === 'medium').length,
    acknowledged: acknowledgedAlerts.length,
    resolved24h: resolvedLast24h.length
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
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

  const getSeverityColor = (severity: Alert['severity']) => {
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

  const getStatusIcon = (status: Alert['status']) => {
    switch (status) {
      case 'firing':
        return <Zap className="h-4 w-4 text-red-500" />;
      case 'acknowledged':
        return <CheckCircle className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-orange-500" />
            Alert & Notification System
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor alerts, manage notification channels, and configure escalation policies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchAlertsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{alertStats.active}</p>
              <p className="text-sm text-gray-400">Active</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{alertStats.critical}</p>
              <p className="text-sm text-gray-400">Critical</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{alertStats.high}</p>
              <p className="text-sm text-gray-400">High</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{alertStats.medium}</p>
              <p className="text-sm text-gray-400">Medium</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{alertStats.acknowledged}</p>
              <p className="text-sm text-gray-400">Acknowledged</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{alertStats.resolved24h}</p>
              <p className="text-sm text-gray-400">Resolved 24h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="channels">Notification Channels</TabsTrigger>
          <TabsTrigger value="escalation">Escalation Policies</TabsTrigger>
          <TabsTrigger value="correlation">Alert Correlation</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Active Alerts */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Active Alerts</h2>
              <Badge variant="secondary">{activeAlerts.length} firing</Badge>
            </div>
            
            {activeAlerts.length > 0 ? (
              <div className="space-y-3">
                {activeAlerts.map(alert => (
                  <Card key={alert.id} className="p-4 border-gray-800">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(alert.status)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{alert.ruleName}</h4>
                            <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Source: {alert.source}</span>
                            <span>Started: {formatDistanceToNow(alert.startedAt, { addSuffix: true })}</span>
                            {alert.runbookUrl && (
                              <a href={alert.runbookUrl} className="text-blue-400 hover:text-blue-300">
                                Runbook
                              </a>
                            )}
                          </div>
                          
                          {/* Tags */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(alert.tags).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {alert.status === 'firing' && (
                          <Button size="sm" variant="outline">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4 mr-1" />
                          Silence
                        </Button>
                        <Button size="sm">
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-300 mb-2">All Clear!</h3>
                <p className="text-gray-500">No active alerts at this time</p>
              </div>
            )}
          </Card>

          {/* Recent Alert Activity */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {alerts.slice(0, 10).map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <p className="font-medium text-sm">{alert.ruleName}</p>
                      <p className="text-xs text-gray-400">
                        {alert.status === 'resolved' && alert.resolvedAt
                          ? `Resolved ${formatDistanceToNow(alert.resolvedAt, { addSuffix: true })}`
                          : `Started ${formatDistanceToNow(alert.startedAt, { addSuffix: true })}`
                        }
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                    {alert.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <AlertRulesManager 
            rules={alertRules}
            channels={notificationChannels}
            onCreateRule={(rule) => {
              console.log('Create rule:', rule);
            }}
            onUpdateRule={(ruleId, updates) => {
              console.log('Update rule:', ruleId, updates);
            }}
            onDeleteRule={(ruleId) => {
              console.log('Delete rule:', ruleId);
            }}
          />
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <NotificationChannels 
            channels={notificationChannels}
            onCreateChannel={(channel) => {
              console.log('Create channel:', channel);
            }}
            onUpdateChannel={(channelId, updates) => {
              console.log('Update channel:', channelId, updates);
            }}
            onTestChannel={(channelId) => {
              console.log('Test channel:', channelId);
            }}
          />
        </TabsContent>

        <TabsContent value="escalation" className="space-y-4">
          <EscalationPolicies 
            onCreatePolicy={(policy) => {
              console.log('Create escalation policy:', policy);
            }}
          />
        </TabsContent>

        <TabsContent value="correlation" className="space-y-4">
          <AlertCorrelation 
            alerts={alerts}
            onCreateCorrelationRule={(rule) => {
              console.log('Create correlation rule:', rule);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}