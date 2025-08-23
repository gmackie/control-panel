export const getAlerts = jest.fn().mockResolvedValue([
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

export const getAlertRules = jest.fn().mockResolvedValue([
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

export const createAlertRule = jest.fn().mockImplementation(async (rule) => ({
  id: 'rule-new',
  ...rule,
  createdAt: new Date().toISOString()
}));

export const updateAlertRule = jest.fn().mockImplementation(async (id, updates) => ({
  id,
  ...updates,
  updatedAt: new Date().toISOString()
}));

export const deleteAlertRule = jest.fn().mockResolvedValue(true);

export const acknowledgeAlert = jest.fn().mockResolvedValue({
  success: true,
  alert: {
    id: 'alert-1',
    status: 'acknowledged'
  }
});

export const resolveAlert = jest.fn().mockResolvedValue({
  success: true,
  alert: {
    id: 'alert-1',
    status: 'resolved'
  }
});