export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: 'info' | 'warning' | 'critical';
  type: 'threshold' | 'anomaly' | 'availability' | 'custom';
  target: AlertTarget;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldown?: number; // Minutes before alert can fire again
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface AlertTarget {
  type: 'service' | 'database' | 'metric' | 'api_endpoint' | 'custom';
  id?: string; // Service ID, Database ID, etc.
  name: string;
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  id: string;
  type: 'metric' | 'status' | 'error_rate' | 'response_time' | 'custom';
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'contains' | 'not_contains';
  value: number | string | boolean;
  duration?: number; // Minutes the condition must be true
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  window?: number; // Minutes to look back
}

export interface AlertAction {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'discord';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'firing' | 'resolved';
  message: string;
  details: Record<string, any>;
  startedAt: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  notes?: string;
}

export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'availability' | 'security' | 'business' | 'custom';
  rule: Partial<AlertRule>;
  recommended: boolean;
}

// Alert Templates
export const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Alert when error rate exceeds threshold',
    category: 'performance',
    recommended: true,
    rule: {
      name: 'High Error Rate Alert',
      severity: 'critical',
      type: 'threshold',
      conditions: [
        {
          id: '1',
          type: 'error_rate',
          operator: 'gt',
          value: 5, // 5%
          duration: 5,
          window: 10,
        }
      ],
    }
  },
  {
    id: 'slow-response-time',
    name: 'Slow Response Time',
    description: 'Alert when API response time is too high',
    category: 'performance',
    recommended: true,
    rule: {
      name: 'Slow Response Time Alert',
      severity: 'warning',
      type: 'threshold',
      conditions: [
        {
          id: '1',
          type: 'response_time',
          operator: 'gt',
          value: 1000, // 1 second
          duration: 5,
          aggregation: 'avg',
          window: 5,
        }
      ],
    }
  },
  {
    id: 'service-down',
    name: 'Service Down',
    description: 'Alert when a service is unavailable',
    category: 'availability',
    recommended: true,
    rule: {
      name: 'Service Down Alert',
      severity: 'critical',
      type: 'availability',
      conditions: [
        {
          id: '1',
          type: 'status',
          operator: 'eq',
          value: 'unhealthy',
          duration: 2,
        }
      ],
    }
  },
  {
    id: 'high-memory-usage',
    name: 'High Memory Usage',
    description: 'Alert when memory usage is critical',
    category: 'performance',
    recommended: false,
    rule: {
      name: 'High Memory Usage Alert',
      severity: 'warning',
      type: 'threshold',
      conditions: [
        {
          id: '1',
          type: 'metric',
          operator: 'gt',
          value: 85, // 85%
          duration: 10,
          aggregation: 'avg',
        }
      ],
    }
  },
  {
    id: 'failed-payments',
    name: 'Failed Payments',
    description: 'Alert on high payment failure rate',
    category: 'business',
    recommended: false,
    rule: {
      name: 'Failed Payments Alert',
      severity: 'critical',
      type: 'threshold',
      conditions: [
        {
          id: '1',
          type: 'custom',
          operator: 'gt',
          value: 10, // More than 10 failed payments
          window: 60, // In the last hour
        }
      ],
    }
  },
  {
    id: 'low-disk-space',
    name: 'Low Disk Space',
    description: 'Alert when disk space is running low',
    category: 'performance',
    recommended: false,
    rule: {
      name: 'Low Disk Space Alert',
      severity: 'warning',
      type: 'threshold',
      conditions: [
        {
          id: '1',
          type: 'metric',
          operator: 'lt',
          value: 10, // Less than 10% free
          duration: 5,
        }
      ],
    }
  },
];

export interface AlertMetrics {
  total: number;
  active: number;
  firing: number;
  resolved: number;
  bySeverity: {
    info: number;
    warning: number;
    critical: number;
  };
  recentAlerts: AlertInstance[];
  topRules: Array<{
    ruleId: string;
    ruleName: string;
    triggerCount: number;
  }>;
}