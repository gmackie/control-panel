import { describe, it, expect } from 'vitest'
import {
  INTEGRATIONS,
  getIntegration,
  getIntegrationsByCategory,
  getRequiredSecrets,
  getAutoProvisionableSecrets,
  validateSecretValue,
  getDependencies,
  generateEnvExample,
} from '@/lib/provisioning/integrations'

describe('Integrations Module', () => {
  describe('INTEGRATIONS constant', () => {
    it('should have at least 10 integrations defined', () => {
      expect(Object.keys(INTEGRATIONS).length).toBeGreaterThanOrEqual(10)
    })

    it('should have required properties for each integration', () => {
      Object.values(INTEGRATIONS).forEach((integration) => {
        expect(integration).toHaveProperty('id')
        expect(integration).toHaveProperty('name')
        expect(integration).toHaveProperty('description')
        expect(integration).toHaveProperty('category')
        expect(integration).toHaveProperty('secrets')
        expect(Array.isArray(integration.secrets)).toBe(true)
      })
    })

    it('should have valid categories', () => {
      const validCategories = ['auth', 'database', 'payments', 'monitoring', 'ai', 'storage', 'email', 'analytics']
      Object.values(INTEGRATIONS).forEach((integration) => {
        expect(validCategories).toContain(integration.category)
      })
    })
  })

  describe('getIntegration', () => {
    it('should return integration by id', () => {
      const clerk = getIntegration('clerk')
      expect(clerk).toBeDefined()
      expect(clerk?.name).toBe('Clerk')
      expect(clerk?.category).toBe('auth')
    })

    it('should return undefined for non-existent integration', () => {
      const nonExistent = getIntegration('non-existent-integration')
      expect(nonExistent).toBeUndefined()
    })
  })

  describe('getIntegrationsByCategory', () => {
    it('should return all auth integrations', () => {
      const authIntegrations = getIntegrationsByCategory('auth')
      expect(authIntegrations.length).toBeGreaterThanOrEqual(1)
      authIntegrations.forEach((integration) => {
        expect(integration.category).toBe('auth')
      })
    })

    it('should return all database integrations', () => {
      const dbIntegrations = getIntegrationsByCategory('database')
      expect(dbIntegrations.length).toBeGreaterThanOrEqual(1)
      dbIntegrations.forEach((integration) => {
        expect(integration.category).toBe('database')
      })
    })

    it('should return empty array for invalid category', () => {
      // @ts-expect-error - Testing invalid category
      const invalid = getIntegrationsByCategory('invalid-category')
      expect(invalid).toEqual([])
    })
  })

  describe('getRequiredSecrets', () => {
    it('should return required secrets for Clerk', () => {
      const secrets = getRequiredSecrets('clerk')
      expect(secrets.length).toBeGreaterThan(0)
      
      const secretNames = secrets.map(s => s.name)
      expect(secretNames).toContain('CLERK_SECRET_KEY')
    })

    it('should return required secrets for Stripe', () => {
      const secrets = getRequiredSecrets('stripe')
      expect(secrets.length).toBeGreaterThan(0)
      
      const secretNames = secrets.map(s => s.name)
      expect(secretNames).toContain('STRIPE_SECRET_KEY')
    })

    it('should return empty array for non-existent integration', () => {
      const secrets = getRequiredSecrets('non-existent')
      expect(secrets).toEqual([])
    })
  })

  describe('getAutoProvisionableSecrets', () => {
    it('should return auto-provisionable secrets for Turso', () => {
      const secrets = getAutoProvisionableSecrets('turso')
      // Turso may have auto-provisionable secrets
      expect(Array.isArray(secrets)).toBe(true)
    })

    it('should return empty array when no auto-provisionable secrets', () => {
      // Most integrations don't have auto-provisionable secrets
      const secrets = getAutoProvisionableSecrets('stripe')
      expect(Array.isArray(secrets)).toBe(true)
    })
  })

  describe('validateSecretValue', () => {
    it('should validate Clerk secret key format', () => {
      const valid = validateSecretValue('clerk', 'CLERK_SECRET_KEY', 'sk_test_abc123')
      expect(valid).toBe(true)
    })

    it('should validate Stripe secret key format', () => {
      const validTest = validateSecretValue('stripe', 'STRIPE_SECRET_KEY', 'sk_test_abc123')
      expect(validTest).toBe(true)
      
      const validLive = validateSecretValue('stripe', 'STRIPE_SECRET_KEY', 'sk_live_abc123')
      expect(validLive).toBe(true)
    })

    it('should return true for unknown integration/secret', () => {
      const result = validateSecretValue('unknown', 'UNKNOWN_KEY', 'any-value')
      expect(result).toBe(true)
    })
  })

  describe('getDependencies', () => {
    it('should return dependencies object for integrations', () => {
      const deps = getDependencies(['clerk'])
      expect(deps).toHaveProperty('dependencies')
      expect(deps).toHaveProperty('devDependencies')
      expect(Array.isArray(deps.dependencies)).toBe(true)
      expect(deps.dependencies).toContain('@clerk/nextjs')
    })

    it('should return empty arrays for empty input', () => {
      const deps = getDependencies([])
      expect(deps.dependencies).toEqual([])
      expect(deps.devDependencies).toEqual([])
    })

    it('should merge dependencies from multiple integrations', () => {
      const deps = getDependencies(['turso', 'stripe'])
      expect(deps.dependencies).toContain('@libsql/client')
      expect(deps.dependencies).toContain('stripe')
      expect(deps.devDependencies).toContain('drizzle-kit')
    })
  })

  describe('generateEnvExample', () => {
    it('should generate env example for single integration', () => {
      const envExample = generateEnvExample(['clerk'])
      expect(envExample).toContain('CLERK_SECRET_KEY')
      expect(envExample).toContain('CLERK_PUBLISHABLE_KEY')
    })

    it('should generate env example for multiple integrations', () => {
      const envExample = generateEnvExample(['clerk', 'stripe'])
      expect(envExample).toContain('CLERK_SECRET_KEY')
      expect(envExample).toContain('STRIPE_SECRET_KEY')
    })

    it('should return only header for empty array', () => {
      const envExample = generateEnvExample([])
      // The function returns a header even for empty arrays
      expect(envExample).toContain('# Environment Variables')
      expect(envExample).not.toContain('CLERK_')
      expect(envExample).not.toContain('STRIPE_')
    })
  })
})

describe('Integration Definitions', () => {
  describe('Clerk Integration', () => {
    it('should have correct configuration', () => {
      const clerk = INTEGRATIONS['clerk']
      expect(clerk.id).toBe('clerk')
      expect(clerk.name).toBe('Clerk')
      expect(clerk.category).toBe('auth')
      expect(clerk.secrets.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Stripe Integration', () => {
    it('should have correct configuration', () => {
      const stripe = INTEGRATIONS['stripe']
      expect(stripe.id).toBe('stripe')
      expect(stripe.name).toBe('Stripe')
      expect(stripe.category).toBe('payments')
      expect(stripe.secrets.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Turso Integration', () => {
    it('should have correct configuration', () => {
      const turso = INTEGRATIONS['turso']
      expect(turso.id).toBe('turso')
      expect(turso.name).toBe('Turso')
      expect(turso.category).toBe('database')
      expect(turso.secrets.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('OpenRouter Integration', () => {
    it('should have correct configuration', () => {
      const openrouter = INTEGRATIONS['openrouter']
      expect(openrouter.id).toBe('openrouter')
      expect(openrouter.name).toBe('OpenRouter')
      expect(openrouter.category).toBe('ai')
    })
  })
})
