import { http, HttpResponse } from 'msw'

const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@gmac.io',
  image: 'https://avatars.githubusercontent.com/u/1?v=4'
}

const mockMetrics = {
  timestamp: '2024-01-15T10:00:00Z',
  system: {
    cpu: { usage: 45.2, cores: 8, load: [1.2, 1.1, 0.9] },
    memory: { used: 2048, total: 8192, free: 6144, cached: 1024 },
    disk: { used: 25600, total: 102400, free: 76800, io: { read: 150, write: 200 } },
    network: { rx: 1024000, tx: 512000, connections: 45 }
  },
  applications: {
    gitea: { status: 'healthy', responseTime: 120, uptime: 99.9 },
    drone: { status: 'healthy', responseTime: 85, uptime: 99.5 },
    harbor: { status: 'healthy', responseTime: 200, uptime: 99.8 },
    argocd: { status: 'healthy', responseTime: 95, uptime: 99.7 }
  }
}

const mockAlerts = [
  {
    id: '1',
    name: 'High CPU Usage',
    status: 'firing' as const,
    severity: 'high' as const,
    message: 'CPU usage is above 80%',
    labels: { instance: 'node-1', job: 'node-exporter' },
    annotations: { description: 'High CPU usage detected', runbook_url: '' },
    generatorURL: '',
    fingerprint: 'abc123',
    startsAt: '2024-01-15T10:00:00Z',
    endsAt: null,
    updatedAt: '2024-01-15T10:00:00Z'
  }
]

const mockClusterNodes = [
  {
    name: 'node-1',
    status: 'Ready',
    roles: ['worker'],
    age: '5d',
    version: 'v1.28.0',
    ready: true,
    schedulable: true,
    cpu: { usage: '45%', capacity: '4 cores' },
    memory: { usage: '2.1GB', capacity: '8GB' },
    pods: { running: 12, capacity: 110 },
    conditions: [
      { type: 'Ready', status: 'True', lastHeartbeatTime: '2024-01-15T10:00:00Z' }
    ]
  }
]

const mockServices = [
  {
    name: 'gitea',
    status: 'healthy',
    url: 'https://git.gmac.io',
    version: '1.21.0',
    lastCheck: '2024-01-15T10:00:00Z',
    responseTime: 120,
    uptime: 99.9,
    endpoints: 4
  }
]

export const handlers = [
  // Auth endpoints
  http.get('/api/auth/session', () => {
    return HttpResponse.json({ user: mockUser })
  }),

  http.get('/api/auth/verify', () => {
    return HttpResponse.json({ valid: true, user: mockUser })
  }),

  // Monitoring endpoints
  http.get('/api/monitoring/metrics', ({ request }) => {
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange')
    const services = url.searchParams.get('services')?.split(',')
    
    return HttpResponse.json({
      ...mockMetrics,
      timeRange,
      services: services || Object.keys(mockMetrics.applications)
    })
  }),

  http.get('/api/monitoring/alerts', () => {
    return HttpResponse.json({
      alerts: mockAlerts,
      summary: {
        total: mockAlerts.length,
        firing: mockAlerts.filter(a => a.status === 'firing').length,
        pending: mockAlerts.filter(a => a.status === 'pending').length,
        resolved: mockAlerts.filter(a => a.status === 'resolved').length,
        mttr: 120
      }
    })
  }),

  http.post('/api/monitoring/alerts/:id/acknowledge', ({ params }) => {
    return HttpResponse.json({ success: true, alertId: params.id })
  }),

  http.post('/api/monitoring/alerts/:id/resolve', ({ params }) => {
    return HttpResponse.json({ success: true, alertId: params.id })
  }),

  // Cluster endpoints
  http.get('/api/cluster/nodes', () => {
    return HttpResponse.json({ nodes: mockClusterNodes })
  }),

  http.post('/api/cluster/nodes/:name/:action', ({ params }) => {
    return HttpResponse.json({ 
      success: true, 
      node: params.name,
      action: params.action
    })
  }),

  http.get('/api/cluster/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      nodes: {
        ready: 3,
        total: 3,
        master: 1,
        worker: 2
      },
      pods: {
        running: 45,
        pending: 0,
        failed: 0,
        succeeded: 12
      },
      version: 'v1.28.0'
    })
  }),

  // Services endpoints
  http.get('/api/services', () => {
    return HttpResponse.json({ services: mockServices })
  }),

  http.get('/api/services/:name/health', ({ params }) => {
    const service = mockServices.find(s => s.name === params.name)
    return HttpResponse.json(service || { status: 'unknown' })
  }),

  // Applications endpoints
  http.get('/api/applications', () => {
    return HttpResponse.json({
      applications: [
        {
          id: '1',
          name: 'sample-app',
          gitRepo: 'https://git.gmac.io/gmac/sample-app',
          dockerImage: 'registry.gmac.io/gmac/sample-app:latest',
          status: 'deployed',
          environment: 'production',
          deployedAt: '2024-01-15T10:00:00Z',
          health: 'healthy'
        }
      ]
    })
  }),

  http.post('/api/applications', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      success: true,
      application: { id: Date.now().toString(), ...body }
    }, { status: 201 })
  }),

  // Infrastructure endpoints
  http.get('/api/infrastructure/overview', () => {
    return HttpResponse.json({
      cluster: {
        status: 'healthy',
        nodes: 3,
        pods: 45,
        services: 12,
        uptime: '5d 12h'
      },
      resources: {
        cpu: { used: 45, total: 100, unit: '%' },
        memory: { used: 6.2, total: 24, unit: 'GB' },
        storage: { used: 250, total: 1000, unit: 'GB' }
      },
      costs: {
        current: 125.50,
        projected: 3890.00,
        currency: 'USD'
      }
    })
  }),

  // Registry endpoints
  http.get('/api/registry/repositories', () => {
    return HttpResponse.json({
      repositories: [
        {
          name: 'gmac/control-panel',
          tags: ['latest', 'v1.0.0', 'dev'],
          size: '250MB',
          lastPush: '2024-01-15T10:00:00Z'
        }
      ]
    })
  }),

  // Webhooks
  http.post('/api/webhooks/deployment', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ 
      success: true, 
      processed: true,
      event: body 
    })
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    })
  }),

  // Stream endpoints (for testing purposes)
  http.get('/api/stream/metrics', () => {
    return new HttpResponse('data: {"type": "metric", "data": ' + JSON.stringify(mockMetrics) + '}\n\n', {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }),

  // Error handlers
  http.get('/api/test/error/400', () => {
    return HttpResponse.json({ error: 'Bad Request' }, { status: 400 })
  }),

  http.get('/api/test/error/401', () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }),

  http.get('/api/test/error/403', () => {
    return HttpResponse.json({ error: 'Forbidden' }, { status: 403 })
  }),

  http.get('/api/test/error/404', () => {
    return HttpResponse.json({ error: 'Not Found' }, { status: 404 })
  }),

  http.get('/api/test/error/500', () => {
    return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  })
]