import { GET, POST } from '../monitoring/metrics/route'
import { GET as AlertsGET, POST as AlertsPOST } from '../monitoring/alerts/route'
import { getServerSession } from 'next-auth/next'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('next-auth/next')
jest.mock('../../../lib/auth')

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('/api/monitoring/metrics', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@gmac.io' }
    } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return system metrics with default parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('system')
      expect(data.system).toHaveProperty('cpu')
      expect(data.system).toHaveProperty('memory')
      expect(data.system).toHaveProperty('disk')
      expect(data.system).toHaveProperty('network')
      expect(data).toHaveProperty('applications')
    })

    it('should filter metrics by time range', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/metrics?timeRange=1h')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timeRange).toBe('1h')
    })

    it('should filter metrics by services', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/metrics?services=gitea,drone')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.services)).toBe(true)
      expect(data.services).toEqual(['gitea', 'drone'])
    })

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/monitoring/metrics')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should handle invalid time range gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/metrics?timeRange=invalid')
      const response = await GET(request)

      expect(response.status).toBe(200) // Should still return data with invalid range ignored
    })
  })
})

describe('/api/monitoring/alerts', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@gmac.io' }
    } as any)
  })

  describe('GET', () => {
    it('should return alerts with summary', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/alerts')
      const response = await AlertsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('alerts')
      expect(data).toHaveProperty('summary')
      expect(Array.isArray(data.alerts)).toBe(true)
      expect(data.summary).toHaveProperty('total')
      expect(data.summary).toHaveProperty('firing')
      expect(data.summary).toHaveProperty('pending')
      expect(data.summary).toHaveProperty('resolved')
      expect(data.summary).toHaveProperty('mttr')
    })

    it('should filter alerts by status', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/alerts?status=firing')
      const response = await AlertsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.alerts.every((alert: any) => alert.status === 'firing' || data.alerts.length === 0)).toBe(true)
    })

    it('should filter alerts by severity', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/alerts?severity=high')
      const response = await AlertsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.alerts.every((alert: any) => alert.severity === 'high' || data.alerts.length === 0)).toBe(true)
    })

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/monitoring/alerts')
      const response = await AlertsGET(request)

      expect(response.status).toBe(401)
    })
  })

  describe('POST', () => {
    it('should create a new alert rule', async () => {
      const alertRule = {
        name: 'Test Alert',
        query: 'up == 0',
        severity: 'critical',
        description: 'Test alert rule'
      }

      const request = new NextRequest('http://localhost:3000/api/monitoring/alerts', {
        method: 'POST',
        body: JSON.stringify(alertRule),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await AlertsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('alert')
      expect(data.alert).toMatchObject(alertRule)
    })

    it('should validate required fields', async () => {
      const invalidRule = {
        query: 'up == 0'
        // missing name and severity
      }

      const request = new NextRequest('http://localhost:3000/api/monitoring/alerts', {
        method: 'POST',
        body: JSON.stringify(invalidRule),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await AlertsPOST(request)

      expect(response.status).toBe(400)
    })

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/monitoring/alerts', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await AlertsPOST(request)

      expect(response.status).toBe(401)
    })
  })
})

describe('Monitoring API Error Handling', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@gmac.io' }
    } as any)
  })

  it('should handle malformed JSON in POST requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/alerts', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await AlertsPOST(request)
    
    expect(response.status).toBe(400)
  })

  it('should handle empty request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/alerts', {
      method: 'POST',
      body: '',
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await AlertsPOST(request)
    
    expect(response.status).toBe(400)
  })

  it('should handle missing content-type header', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/alerts', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' })
    })

    const response = await AlertsPOST(request)
    
    // Should still work as Next.js handles this gracefully
    expect([200, 201, 400]).toContain(response.status)
  })
})