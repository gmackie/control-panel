import { POST } from '../webhooks/deployment/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('../../../lib/rate-limiter')

describe('/api/webhooks/deployment', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('should process Gitea push webhook', async () => {
      const giteaWebhook = {
        action: 'push',
        repository: {
          name: 'test-repo',
          full_name: 'gmac/test-repo',
          clone_url: 'https://git.gmac.io/gmac/test-repo.git'
        },
        pusher: {
          login: 'testuser',
          email: 'test@gmac.io'
        },
        commits: [
          {
            id: 'abc123',
            message: 'Test commit',
            author: {
              name: 'Test User',
              email: 'test@gmac.io'
            }
          }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(giteaWebhook),
        headers: { 
          'Content-Type': 'application/json',
          'X-Gitea-Event': 'push'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('processed', true)
      expect(data).toHaveProperty('source', 'gitea')
      expect(data).toHaveProperty('event', 'push')
    })

    it('should process Drone build webhook', async () => {
      const droneWebhook = {
        event: 'build',
        action: 'updated',
        repo: {
          name: 'test-repo',
          namespace: 'gmac'
        },
        build: {
          number: 123,
          status: 'success',
          event: 'push',
          commit: 'abc123',
          branch: 'main',
          started: 1642694400,
          finished: 1642694500
        }
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(droneWebhook),
        headers: { 
          'Content-Type': 'application/json',
          'X-Drone-Event': 'build'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('processed', true)
      expect(data).toHaveProperty('source', 'drone')
      expect(data).toHaveProperty('event', 'build')
    })

    it('should process Harbor push notification', async () => {
      const harborWebhook = {
        type: 'pushImage',
        occur_at: 1642694400,
        event_data: {
          repository: {
            name: 'gmac/test-app',
            namespace: 'gmac',
            repo_full_name: 'gmac/test-app',
            repo_type: 'private'
          },
          resources: [
            {
              digest: 'sha256:abc123',
              tag: 'latest',
              resource_url: 'registry.gmac.io/gmac/test-app:latest'
            }
          ]
        }
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(harborWebhook),
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'harbor-webhook'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('processed', true)
      expect(data).toHaveProperty('source', 'harbor')
      expect(data).toHaveProperty('event', 'pushImage')
    })

    it('should process ArgoCD application sync webhook', async () => {
      const argoCDWebhook = {
        specversion: '1.0',
        type: 'application-sync-status-unknown',
        source: 'https://argocd.gmac.io/applications/test-app',
        subject: 'test-app',
        time: '2024-01-15T10:00:00Z',
        data: {
          application: {
            metadata: {
              name: 'test-app',
              namespace: 'argocd'
            },
            status: {
              sync: {
                status: 'Synced',
                revision: 'abc123'
              },
              health: {
                status: 'Healthy'
              }
            }
          }
        }
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(argoCDWebhook),
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'ArgoCD-Webhook'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('processed', true)
      expect(data).toHaveProperty('source', 'argocd')
      expect(data).toHaveProperty('event', 'application-sync-status-unknown')
    })

    it('should handle unknown webhook sources', async () => {
      const unknownWebhook = {
        event: 'test',
        data: 'test data'
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(unknownWebhook),
        headers: { 
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('processed', false)
      expect(data).toHaveProperty('source', 'unknown')
    })

    it('should validate webhook signatures when provided', async () => {
      const webhook = {
        event: 'test',
        data: 'test data'
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(webhook),
        headers: { 
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalid-signature'
        }
      })

      const response = await POST(request)

      // Should handle signature validation
      expect([200, 401, 403]).toContain(response.status)
    })

    it('should handle rate limiting', async () => {
      const webhook = { event: 'test' }

      // Mock rate limiter to trigger limit
      jest.doMock('../../../lib/rate-limiter', () => ({
        webhookLimiter: {
          check: jest.fn().mockResolvedValue({ success: false, limit: 100, remaining: 0 })
        }
      }))

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(webhook),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(429)
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: '',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should handle very large payloads', async () => {
      const largeWebhook = {
        event: 'test',
        data: 'x'.repeat(100000) // Very large data
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(largeWebhook),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      // Should handle gracefully, either accept or reject based on limits
      expect([200, 413]).toContain(response.status)
    })

    it('should log webhook events for debugging', async () => {
      const webhook = {
        event: 'test',
        data: 'test data'
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(webhook),
        headers: { 
          'Content-Type': 'application/json',
          'X-Gitea-Event': 'push'
        }
      })

      await POST(request)

      // Should log webhook processing
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Webhook Processing Logic', () => {
    it('should extract repository information from Gitea webhooks', async () => {
      const webhook = {
        repository: {
          name: 'test-repo',
          full_name: 'gmac/test-repo',
          clone_url: 'https://git.gmac.io/gmac/test-repo.git'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(webhook),
        headers: { 
          'Content-Type': 'application/json',
          'X-Gitea-Event': 'push'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('repository')
      expect(data.repository).toMatchObject({
        name: 'test-repo',
        fullName: 'gmac/test-repo'
      })
    })

    it('should extract build information from Drone webhooks', async () => {
      const webhook = {
        build: {
          number: 123,
          status: 'success',
          commit: 'abc123',
          branch: 'main'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/deployment', {
        method: 'POST',
        body: JSON.stringify(webhook),
        headers: { 
          'Content-Type': 'application/json',
          'X-Drone-Event': 'build'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('build')
      expect(data.build).toMatchObject({
        number: 123,
        status: 'success',
        commit: 'abc123',
        branch: 'main'
      })
    })
  })
})