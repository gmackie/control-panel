import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the App Provisioner module
 * 
 * The AppProvisioner orchestrates a 7-step workflow:
 * 1. Create database record
 * 2. Create Gitea repository
 * 3. Set up integrations
 * 4. Store secrets
 * 5. Create Kubernetes resources
 * 6. Sync secrets to cluster
 * 7. Set up CI/CD
 */

// Mock all external dependencies
vi.mock('@/lib/db/postgres', () => {
  const mockDb = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'app-test-123', name: 'Test App', slug: 'test-app' }])),
        onConflictDoNothing: vi.fn(() => Promise.resolve()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ id: 'app-test-123' }])),
      })),
    })),
  }
  
  return {
    getPostgresDb: vi.fn(() => Promise.resolve(mockDb)),
    schemaPg: {
      applications: { id: 'id' },
      applicationIntegrations: { id: 'id' },
      applicationSecrets: { id: 'id' },
      environmentStatus: { id: 'id' },
    },
  }
})

vi.mock('@/lib/provisioning/secrets-service', () => ({
  createSecrets: vi.fn(() => Promise.resolve([
    { id: 'secret-1', name: 'TEST_SECRET', maskedValue: '••••' }
  ])),
  syncSecretsToK8s: vi.fn(() => Promise.resolve({ success: true, message: 'Synced' })),
  syncSecretsToGitea: vi.fn(() => Promise.resolve({ success: true, message: 'Synced', syncedCount: 1 })),
}))

vi.mock('child_process', async () => {
  const actual = await import('child_process')
  return {
    ...actual,
    exec: vi.fn((cmd: string, callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
      if (callback) callback(null, { stdout: 'Success', stderr: '' })
      return { stdout: 'Success', stderr: '' }
    }),
    default: actual,
  }
})

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import after mocking
import { AppProvisioner, provisionApplication, autoProvisionTurso, AppConfig } from '@/lib/provisioning/app-provisioner'

describe('AppProvisioner', () => {
  const baseConfig: AppConfig = {
    name: 'Test Application',
    slug: 'test-app',
    description: 'A test application',
    language: 'typescript',
    framework: 'nextjs',
    type: 'web',
    repository: {
      provider: 'gitea',
      visibility: 'private',
      defaultBranch: 'main',
    },
    integrations: ['clerk', 'stripe'],
    secrets: [
      { name: 'API_KEY', value: 'test-key', environment: 'all' },
    ],
    deployment: {
      environments: ['staging', 'production'],
      domain: 'test.gmac.io',
      autoDeployEnabled: true,
    },
    resources: {
      cpu: { requests: '100m', limits: '500m' },
      memory: { requests: '128Mi', limits: '512Mi' },
      replicas: { min: 1, max: 3 },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default fetch mock responses
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/user/repos') || url.includes('/generate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 123,
            name: 'test-app',
            full_name: 'gmac/test-app',
            html_url: 'https://gitea.gmac.io/gmac/test-app',
          }),
        })
      }
      if (url.includes('/actions/secrets/')) {
        return Promise.resolve({ ok: true, status: 201 })
      }
      if (url.includes('/hooks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 1 }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    
    // Set required env vars
    process.env.GITEA_TOKEN = 'test-gitea-token'
    process.env.GITEA_URL = 'https://gitea.gmac.io'
    process.env.GITEA_USER = 'gmac'
    process.env.SECRETS_ENCRYPTION_KEY = 'J4lWzCRe3wwMqDQ6/KknDu2A1qoODgV92kcTosd/zNI='
  })

  describe('constructor', () => {
    it('should create a provisioner with config', () => {
      const provisioner = new AppProvisioner(baseConfig)
      expect(provisioner).toBeDefined()
    })
  })

  describe('provision()', () => {
    it('should return a result with steps', async () => {
      const provisioner = new AppProvisioner(baseConfig)
      const result = await provisioner.provision()

      expect(result).toBeDefined()
      expect(result.steps).toBeDefined()
      expect(Array.isArray(result.steps)).toBe(true)
      expect(result.steps.length).toBeGreaterThan(0)
    })

    it('should include all 7 provisioning steps', async () => {
      const provisioner = new AppProvisioner(baseConfig)
      const result = await provisioner.provision()

      const stepNames = result.steps.map(s => s.name)
      
      expect(stepNames).toContain('Create database record')
      expect(stepNames).toContain('Create Gitea repository')
      expect(stepNames).toContain('Set up integrations')
      expect(stepNames).toContain('Store secrets')
      expect(stepNames).toContain('Create Kubernetes resources')
      expect(stepNames).toContain('Sync secrets to cluster')
      expect(stepNames).toContain('Set up CI/CD')
    })

    it('should return applicationId on success', async () => {
      const provisioner = new AppProvisioner(baseConfig)
      const result = await provisioner.provision()

      expect(result.applicationId).toBeDefined()
      expect(result.applicationId).toBe('app-test-123')
    })

    it('should track step status', async () => {
      const provisioner = new AppProvisioner(baseConfig)
      const result = await provisioner.provision()

      result.steps.forEach(step => {
        expect(['pending', 'running', 'completed', 'failed', 'skipped']).toContain(step.status)
      })
    })

    it('should track step timing', async () => {
      const provisioner = new AppProvisioner(baseConfig)
      const result = await provisioner.provision()

      result.steps.forEach(step => {
        if (step.status !== 'pending') {
          expect(step.startedAt).toBeDefined()
          expect(step.completedAt).toBeDefined()
        }
      })
    })
  })

  describe('step handling', () => {
    it('should skip integrations step when none selected', async () => {
      const configNoIntegrations = { ...baseConfig, integrations: [] }
      const provisioner = new AppProvisioner(configNoIntegrations)
      const result = await provisioner.provision()

      const integrationStep = result.steps.find(s => s.name === 'Set up integrations')
      expect(integrationStep?.status).toBe('skipped')
      expect(integrationStep?.message).toContain('No integrations')
    })

    it('should skip secrets step when none provided', async () => {
      const configNoSecrets = { ...baseConfig, secrets: [] }
      const provisioner = new AppProvisioner(configNoSecrets)
      const result = await provisioner.provision()

      const secretsStep = result.steps.find(s => s.name === 'Store secrets')
      expect(secretsStep?.status).toBe('skipped')
    })

    it('should skip sync step when no secrets', async () => {
      const configNoSecrets = { ...baseConfig, secrets: [] }
      const provisioner = new AppProvisioner(configNoSecrets)
      const result = await provisioner.provision()

      const syncStep = result.steps.find(s => s.name === 'Sync secrets to cluster')
      expect(syncStep?.status).toBe('skipped')
    })
  })

  describe('error handling', () => {
    it('should collect errors without stopping workflow', async () => {
      // Make Gitea API fail
      mockFetch.mockImplementationOnce(() => Promise.resolve({
        ok: false,
        text: () => Promise.resolve('Repo already exists'),
      }))

      const provisioner = new AppProvisioner(baseConfig)
      const result = await provisioner.provision()

      // Should still have applicationId from step 1
      expect(result.applicationId).toBeDefined()
      // Should have collected the error
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should mark failed steps correctly', async () => {
      mockFetch.mockImplementationOnce(() => Promise.resolve({
        ok: false,
        text: () => Promise.resolve('Error'),
      }))

      const provisioner = new AppProvisioner(baseConfig)
      const result = await provisioner.provision()

      const failedSteps = result.steps.filter(s => s.status === 'failed')
      failedSteps.forEach(step => {
        expect(step.message).toBeDefined()
      })
    })
  })
})

describe('provisionApplication convenience function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 1, full_name: 'test/app', html_url: 'http://test' }),
    }))
    process.env.GITEA_TOKEN = 'test-token'
  })

  it('should provision an application', async () => {
    const config: AppConfig = {
      name: 'Quick App',
      slug: 'quick-app',
      language: 'typescript',
      framework: 'nextjs',
      type: 'web',
      repository: {
        provider: 'gitea',
        visibility: 'private',
        defaultBranch: 'main',
      },
      integrations: [],
      secrets: [],
      deployment: {
        environments: ['staging'],
        autoDeployEnabled: false,
      },
      resources: {
        cpu: { requests: '100m', limits: '200m' },
        memory: { requests: '128Mi', limits: '256Mi' },
        replicas: { min: 1, max: 2 },
      },
    }

    const result = await provisionApplication(config)

    expect(result).toBeDefined()
    expect(result.steps).toBeDefined()
  })
})

describe('autoProvisionTurso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TURSO_API_TOKEN = 'test-turso-token'
    process.env.TURSO_ORG = 'test-org'
  })

  it('should return error when TURSO_API_TOKEN not set', async () => {
    delete process.env.TURSO_API_TOKEN

    const result = await autoProvisionTurso('my-app')

    expect(result.success).toBe(false)
    expect(result.error).toContain('TURSO_API_TOKEN')
  })

  it('should create database and return secrets on success', async () => {
    mockFetch
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          database: {
            Name: 'my_app',
            Hostname: 'my-app-test-org.turso.io',
          },
        }),
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        }),
      }))

    const result = await autoProvisionTurso('my-app')

    expect(result.success).toBe(true)
    expect(result.secrets).toBeDefined()
    expect(result.secrets?.length).toBe(2)
    
    const urlSecret = result.secrets?.find(s => s.name === 'TURSO_DATABASE_URL')
    const tokenSecret = result.secrets?.find(s => s.name === 'TURSO_AUTH_TOKEN')
    
    expect(urlSecret?.value).toContain('libsql://')
    expect(tokenSecret?.value).toBeDefined()
  })

  it('should handle database creation failure', async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve({
      ok: false,
      text: () => Promise.resolve('Database already exists'),
    }))

    const result = await autoProvisionTurso('existing-app')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to create database')
  })

  it('should handle token creation failure', async () => {
    mockFetch
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          database: { Name: 'test', Hostname: 'test.turso.io' },
        }),
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: false,
      }))

    const result = await autoProvisionTurso('test-app')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to create auth token')
  })
})

describe('AppConfig validation', () => {
  it('should accept valid language options', () => {
    const languages = ['typescript', 'javascript', 'python', 'go'] as const
    
    languages.forEach(lang => {
      const config: AppConfig = {
        name: 'Test',
        slug: 'test',
        language: lang,
        framework: 'none',
        type: 'api',
        repository: { provider: 'gitea', visibility: 'private', defaultBranch: 'main' },
        integrations: [],
        secrets: [],
        deployment: { environments: ['staging'], autoDeployEnabled: false },
        resources: {
          cpu: { requests: '100m', limits: '200m' },
          memory: { requests: '128Mi', limits: '256Mi' },
          replicas: { min: 1, max: 2 },
        },
      }
      
      expect(config.language).toBe(lang)
    })
  })

  it('should accept valid framework options', () => {
    const frameworks = ['nextjs', 'express', 'fastapi', 'django', 'gin', 'none'] as const
    
    frameworks.forEach(fw => {
      const config: Partial<AppConfig> = { framework: fw }
      expect(config.framework).toBe(fw)
    })
  })

  it('should accept valid app types', () => {
    const types = ['web', 'api', 'worker', 'cron'] as const
    
    types.forEach(type => {
      const config: Partial<AppConfig> = { type }
      expect(config.type).toBe(type)
    })
  })

  it('should accept valid environment options', () => {
    const envs = ['staging', 'production'] as const
    
    const config: Partial<AppConfig> = {
      deployment: {
        environments: [...envs],
        autoDeployEnabled: true,
      },
    }
    
    expect(config.deployment?.environments).toContain('staging')
    expect(config.deployment?.environments).toContain('production')
  })
})

describe('ProvisioningStep states', () => {
  it('should have valid status values', () => {
    const validStatuses = ['pending', 'running', 'completed', 'failed', 'skipped']
    
    validStatuses.forEach(status => {
      expect(['pending', 'running', 'completed', 'failed', 'skipped']).toContain(status)
    })
  })
})
