const getClusterStatus = jest.fn().mockResolvedValue({
  nodes: [
    {
      id: 'node-1',
      name: 'k3s-master-1',
      role: 'master',
      status: 'ready',
      cpu: { usage: 45, capacity: 4 },
      memory: { usage: 60, capacity: 8192 },
      pods: { running: 25, capacity: 110 }
    },
    {
      id: 'node-2',
      name: 'k3s-worker-1',
      role: 'worker',
      status: 'ready',
      cpu: { usage: 30, capacity: 2 },
      memory: { usage: 40, capacity: 4096 },
      pods: { running: 15, capacity: 110 }
    }
  ],
  namespaces: ['default', 'kube-system', 'control-panel'],
  deployments: [
    {
      name: 'control-panel',
      namespace: 'control-panel',
      replicas: { desired: 3, ready: 3 },
      status: 'healthy'
    }
  ],
  services: [
    {
      name: 'control-panel-service',
      namespace: 'control-panel',
      type: 'LoadBalancer',
      status: 'active'
    }
  ]
});

const getClusterMetrics = jest.fn().mockResolvedValue({
  cpu: {
    current: 37.5,
    average: 35,
    peak: 65
  },
  memory: {
    current: 50,
    average: 48,
    peak: 72
  },
  network: {
    ingress: 125.5,
    egress: 89.3
  },
  storage: {
    used: 45,
    available: 155
  }
});

const getCostEstimate = jest.fn().mockResolvedValue({
  current: 89.50,
  projected: 95.00,
  breakdown: {
    compute: 60,
    storage: 20,
    network: 9.50
  }
});

const scaleDeployment = jest.fn().mockResolvedValue({
  success: true,
  message: 'Deployment scaled successfully'
});

const createNamespace = jest.fn().mockResolvedValue({
  success: true,
  namespace: 'new-namespace'
});

const deleteNamespace = jest.fn().mockResolvedValue({
  success: true
});

module.exports = {
  getClusterStatus,
  getClusterMetrics,
  deployApplication,
  scaleDeployment,
  createNamespace,
  deleteNamespace
};