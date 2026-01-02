import { vi } from 'vitest'

export const getAlerts = vi.fn().mockResolvedValue([
  {
    id: 'alert-1',
    name: 'High CPU Usage',
    severity: 'warning',
    status: 'active',
    message: 'CPU usage above 80%',
    timestamp: new Date().toISOString()
  },
  {
    id: 'alert-2',
    name: 'Memory Pressure',
    severity: 'critical',
    status: 'resolved',
    message: 'Memory usage exceeded 90%',
    timestamp: new Date().toISOString()
  }
]);

export const getAlertRules = vi.fn().mockResolvedValue([
  {
    id: 'rule-1',
    name: 'CPU Alert Rule',
    condition: 'cpu > 80',
    severity: 'warning',
    enabled: true
  },
  {
    id: 'rule-2',
    name: 'Memory Alert Rule',
    condition: 'memory > 90',
    severity: 'critical',
    enabled: true
  }
]);

export const createAlertRule = vi.fn().mockImplementation(async (rule: Record<string, unknown>) => ({
  id: 'rule-new',
  ...rule,
  createdAt: new Date().toISOString()
}));

export const updateAlertRule = vi.fn().mockImplementation(async (id: string, updates: Record<string, unknown>) => ({
  id,
  ...updates,
  updatedAt: new Date().toISOString()
}));

export const deleteAlertRule = vi.fn().mockResolvedValue(true);

export const acknowledgeAlert = vi.fn().mockResolvedValue({
  success: true,
  alert: {
    id: 'alert-1',
    status: 'acknowledged'
  }
});

export const resolveAlert = vi.fn().mockResolvedValue({
  success: true,
  alert: {
    id: 'alert-1',
    status: 'resolved'
  }
});
