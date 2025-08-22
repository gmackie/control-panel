import { AlertRule, AlertInstance, AlertCondition, AlertTarget } from '@/types/alerts';
import { AppService } from '@/types';

// In-memory storage for demo purposes
let alertRules: AlertRule[] = [
  {
    id: '1',
    name: 'High Error Rate - Production',
    description: 'Alert when production error rate exceeds 5%',
    enabled: true,
    severity: 'critical',
    type: 'threshold',
    target: {
      type: 'service',
      name: 'All Production Services',
    },
    conditions: [
      {
        id: '1',
        type: 'error_rate',
        operator: 'gt',
        value: 5,
        duration: 5,
        window: 10,
      }
    ],
    actions: [
      {
        id: '1',
        type: 'slack',
        enabled: true,
        config: {
          channel: '#alerts',
          mention: '@oncall',
        }
      }
    ],
    cooldown: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: '2',
    name: 'Slow API Response',
    description: 'Alert when API response time exceeds 1 second',
    enabled: true,
    severity: 'warning',
    type: 'threshold',
    target: {
      type: 'api_endpoint',
      name: 'API Endpoints',
    },
    conditions: [
      {
        id: '1',
        type: 'response_time',
        operator: 'gt',
        value: 1000,
        duration: 5,
        aggregation: 'avg',
        window: 5,
      }
    ],
    actions: [
      {
        id: '1',
        type: 'email',
        enabled: true,
        config: {
          to: 'ops@gmac.io',
        }
      }
    ],
    cooldown: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggerCount: 0,
  },
];

let alertInstances: AlertInstance[] = [];

export async function getAlertRules(): Promise<AlertRule[]> {
  return alertRules;
}

export async function getAlertRule(id: string): Promise<AlertRule | null> {
  return alertRules.find(rule => rule.id === id) || null;
}

export async function createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>): Promise<AlertRule> {
  const newRule: AlertRule = {
    ...rule,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggerCount: 0,
  };
  
  alertRules.push(newRule);
  return newRule;
}

export async function updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
  const index = alertRules.findIndex(rule => rule.id === id);
  if (index === -1) return null;
  
  alertRules[index] = {
    ...alertRules[index],
    ...updates,
    id, // Prevent ID change
    updatedAt: new Date().toISOString(),
  };
  
  return alertRules[index];
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const index = alertRules.findIndex(rule => rule.id === id);
  if (index === -1) return false;
  
  alertRules.splice(index, 1);
  return true;
}

export async function getAlertInstances(ruleId?: string): Promise<AlertInstance[]> {
  if (ruleId) {
    return alertInstances.filter(instance => instance.ruleId === ruleId);
  }
  return alertInstances;
}

export async function getActiveAlerts(): Promise<AlertInstance[]> {
  return alertInstances.filter(instance => instance.status === 'firing');
}

export async function acknowledgeAlert(alertId: string, userId: string, notes?: string): Promise<AlertInstance | null> {
  const instance = alertInstances.find(i => i.id === alertId);
  if (!instance) return null;
  
  instance.acknowledgedAt = new Date().toISOString();
  instance.acknowledgedBy = userId;
  if (notes) instance.notes = notes;
  
  return instance;
}

export async function resolveAlert(alertId: string): Promise<AlertInstance | null> {
  const instance = alertInstances.find(i => i.id === alertId);
  if (!instance) return null;
  
  instance.status = 'resolved';
  instance.resolvedAt = new Date().toISOString();
  
  return instance;
}

// Alert evaluation engine
export async function evaluateAlerts(services: AppService[]): Promise<AlertInstance[]> {
  const newAlerts: AlertInstance[] = [];
  
  for (const rule of alertRules) {
    if (!rule.enabled) continue;
    
    // Check if rule is in cooldown
    if (rule.lastTriggered) {
      const lastTriggeredTime = new Date(rule.lastTriggered).getTime();
      const cooldownTime = (rule.cooldown || 0) * 60 * 1000; // Convert minutes to ms
      if (Date.now() - lastTriggeredTime < cooldownTime) continue;
    }
    
    // Evaluate conditions based on rule type
    const shouldFire = await evaluateRule(rule, services);
    
    if (shouldFire) {
      // Check if alert is already firing
      const existingAlert = alertInstances.find(
        i => i.ruleId === rule.id && i.status === 'firing'
      );
      
      if (!existingAlert) {
        const newAlert: AlertInstance = {
          id: Date.now().toString(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          status: 'firing',
          message: generateAlertMessage(rule),
          details: {
            target: rule.target,
            conditions: rule.conditions,
          },
          startedAt: new Date().toISOString(),
        };
        
        alertInstances.push(newAlert);
        newAlerts.push(newAlert);
        
        // Update rule
        rule.lastTriggered = new Date().toISOString();
        rule.triggerCount++;
        
        // Execute actions
        await executeActions(rule, newAlert);
      }
    } else {
      // Check if we should resolve an existing alert
      const firingAlert = alertInstances.find(
        i => i.ruleId === rule.id && i.status === 'firing'
      );
      
      if (firingAlert) {
        firingAlert.status = 'resolved';
        firingAlert.resolvedAt = new Date().toISOString();
      }
    }
  }
  
  return newAlerts;
}

async function evaluateRule(rule: AlertRule, services: AppService[]): Promise<boolean> {
  // This is a simplified evaluation - in production, this would query real metrics
  switch (rule.type) {
    case 'threshold':
      return evaluateThresholdRule(rule, services);
    case 'availability':
      return evaluateAvailabilityRule(rule, services);
    default:
      return false;
  }
}

function evaluateThresholdRule(rule: AlertRule, services: AppService[]): boolean {
  // Simulate threshold evaluation
  for (const condition of rule.conditions) {
    switch (condition.type) {
      case 'error_rate':
        // Check error rate across services
        const avgErrorRate = services.reduce((sum, s) => sum + (s.metrics?.errorRate || 0), 0) / services.length;
        return compareValue(avgErrorRate, condition.operator, condition.value as number);
      
      case 'response_time':
        // Check response time
        const avgResponseTime = services.reduce((sum, s) => sum + (s.metrics?.responseTime || 0), 0) / services.length;
        return compareValue(avgResponseTime, condition.operator, condition.value as number);
      
      default:
        return false;
    }
  }
  return false;
}

function evaluateAvailabilityRule(rule: AlertRule, services: AppService[]): boolean {
  for (const condition of rule.conditions) {
    if (condition.type === 'status') {
      // Check if any service matches the status condition
      return services.some(service => 
        compareValue(service.status, condition.operator, condition.value)
      );
    }
  }
  return false;
}

function compareValue(actual: any, operator: string, expected: any): boolean {
  switch (operator) {
    case 'gt': return actual > expected;
    case 'lt': return actual < expected;
    case 'gte': return actual >= expected;
    case 'lte': return actual <= expected;
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'contains': return String(actual).includes(String(expected));
    case 'not_contains': return !String(actual).includes(String(expected));
    default: return false;
  }
}

function generateAlertMessage(rule: AlertRule): string {
  const conditionDescriptions = rule.conditions.map(c => {
    return `${c.type} ${c.operator} ${c.value}`;
  }).join(' AND ');
  
  return `Alert: ${rule.name} - Conditions met: ${conditionDescriptions}`;
}

async function executeActions(rule: AlertRule, alert: AlertInstance): Promise<void> {
  for (const action of rule.actions) {
    if (!action.enabled) continue;
    
    switch (action.type) {
      case 'slack':
        console.log(`[SLACK] Sending alert to ${action.config.channel}: ${alert.message}`);
        break;
      case 'email':
        console.log(`[EMAIL] Sending alert to ${action.config.to}: ${alert.message}`);
        break;
      case 'webhook':
        console.log(`[WEBHOOK] Calling ${action.config.url} with alert data`);
        break;
      default:
        console.log(`[${action.type.toUpperCase()}] Alert: ${alert.message}`);
    }
  }
}

// Generate some mock alert history
export function generateMockAlertHistory(): void {
  const now = new Date();
  
  // Add some resolved alerts
  alertInstances.push(
    {
      id: '100',
      ruleId: '1',
      ruleName: 'High Error Rate - Production',
      severity: 'critical',
      status: 'resolved',
      message: 'Alert: High Error Rate - Production - Conditions met: error_rate gt 5',
      details: {},
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      resolvedAt: new Date(now.getTime() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
    },
    {
      id: '101',
      ruleId: '2',
      ruleName: 'Slow API Response',
      severity: 'warning',
      status: 'resolved',
      message: 'Alert: Slow API Response - Conditions met: response_time gt 1000',
      details: {},
      startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      resolvedAt: new Date(now.getTime() - 23.5 * 60 * 60 * 1000).toISOString(),
    }
  );
  
  // Add a currently firing alert
  alertInstances.push({
    id: '102',
    ruleId: '2',
    ruleName: 'Slow API Response',
    severity: 'warning',
    status: 'firing',
    message: 'Alert: Slow API Response - Conditions met: response_time gt 1000',
    details: {
      target: { type: 'api_endpoint', name: 'API Endpoints' },
      currentValue: 1250,
      threshold: 1000,
    },
    startedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
  });
}

// Initialize with mock data
generateMockAlertHistory();