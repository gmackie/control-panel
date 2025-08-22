import { GET, POST } from '../cluster/nodes/route'
import { GET as HealthGET } from '../cluster/health/route'
import { getServerSession } from 'next-auth/next'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('next-auth/next')
jest.mock('../../../lib/cluster/k3s-client')

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('/api/cluster/nodes', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@gmac.io' }
    } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return cluster nodes', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('nodes')
      expect(Array.isArray(data.nodes)).toBe(true)

      if (data.nodes.length > 0) {
        const node = data.nodes[0]
        expect(node).toHaveProperty('name')
        expect(node).toHaveProperty('status')
        expect(node).toHaveProperty('roles')
        expect(node).toHaveProperty('ready')
        expect(node).toHaveProperty('schedulable')
        expect(node).toHaveProperty('cpu')
        expect(node).toHaveProperty('memory')
        expect(node).toHaveProperty('pods')
      }
    })

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })

  describe('POST', () => {
    it('should perform node action - cordon', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cordon',
          nodeName: 'node-1'
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('action', 'cordon')
      expect(data).toHaveProperty('nodeName', 'node-1')
    })

    it('should perform node action - uncordon', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'uncordon',
          nodeName: 'node-1'
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('action', 'uncordon')
    })

    it('should perform node action - drain', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'drain',
          nodeName: 'node-1'
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('action', 'drain')
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cordon'
          // missing nodeName
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should validate action type', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid-action',
          nodeName: 'node-1'
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
        method: 'POST',
        body: JSON.stringify({ action: 'cordon', nodeName: 'node-1' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })
})

describe('/api/cluster/health', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@gmac.io' }
    } as any)
  })

  describe('GET', () => {
    it('should return cluster health status', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/health')
      const response = await HealthGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('nodes')
      expect(data).toHaveProperty('pods')
      expect(data.nodes).toHaveProperty('ready')
      expect(data.nodes).toHaveProperty('total')
      expect(data.pods).toHaveProperty('running')
      expect(data.pods).toHaveProperty('pending')
      expect(data.pods).toHaveProperty('failed')
    })

    it('should return cluster version info', async () => {
      const request = new NextRequest('http://localhost:3000/api/cluster/health')
      const response = await HealthGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('version')
      expect(typeof data.version).toBe('string')
    })

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/cluster/health')
      const response = await HealthGET(request)

      expect(response.status).toBe(401)
    })
  })
})

describe('Cluster API Error Handling', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@gmac.io' }
    } as any)
  })

  it('should handle k8s client connection errors gracefully', async () => {
    // Mock k8s client to throw error
    const mockError = new Error('Connection refused')
    jest.doMock('../../../lib/cluster/k3s-client', () => ({
      getNodes: jest.fn().mockRejectedValue(mockError)
    }))

    const request = new NextRequest('http://localhost:3000/api/cluster/nodes')
    const response = await GET(request)

    expect(response.status).toBe(500)
  })

  it('should handle invalid JSON in node actions', async () => {
    const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    
    expect(response.status).toBe(400)
  })

  it('should handle missing node name in actions', async () => {
    const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
      method: 'POST',
      body: JSON.stringify({ action: 'cordon' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    
    expect(response.status).toBe(400)
  })

  it('should handle non-existent node names', async () => {
    const request = new NextRequest('http://localhost:3000/api/cluster/nodes', {
      method: 'POST',
      body: JSON.stringify({
        action: 'cordon',
        nodeName: 'non-existent-node'
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    
    // Should handle gracefully, either 404 or 500
    expect([404, 500]).toContain(response.status)
  })
})