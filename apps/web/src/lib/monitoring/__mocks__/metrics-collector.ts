export const getMetrics = jest.fn().mockResolvedValue({
  system: {
    cpu: {
      usage: 45,
      cores: 4,
      loadAverage: [1.2, 1.5, 1.8]
    },
    memory: {
      used: 4096,
      total: 8192,
      free: 4096,
      percentage: 50
    },
    disk: {
      used: 50,
      total: 200,
      free: 150,
      percentage: 25
    },
    network: {
      rx: 125.5,
      tx: 89.3,
      connections: 145
    }
  },
  services: [
    {
      name: 'control-panel',
      status: 'healthy',
      uptime: 86400,
      requests: 1250,
      errors: 3,
      latency: 45
    },
    {
      name: 'api-gateway',
      status: 'healthy',
      uptime: 86400,
      requests: 5420,
      errors: 12,
      latency: 23
    }
  ],
  timestamp: new Date().toISOString()
});

export const getHealthStatus = jest.fn().mockResolvedValue({
  overall: 'healthy',
  components: {
    database: 'healthy',
    cache: 'healthy',
    queue: 'degraded',
    storage: 'healthy'
  },
  lastCheck: new Date().toISOString()
});

export const getInfrastructureMetrics = jest.fn().mockResolvedValue({
  nodes: 3,
  pods: 45,
  containers: 67,
  services: 12,
  deployments: 8,
  cpu: {
    allocated: 60,
    available: 40
  },
  memory: {
    allocated: 70,
    available: 30
  }
});