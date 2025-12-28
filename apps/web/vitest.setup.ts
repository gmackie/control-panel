import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: { name: 'Test User', email: 'test@example.com' }
  })),
}))

// Mock environment variables
// Must be exactly 32 bytes when base64 decoded
process.env.SECRETS_ENCRYPTION_KEY = 'J4lWzCRe3wwMqDQ6/KknDu2A1qoODgV92kcTosd/zNI='
process.env.GITEA_URL = 'https://gitea.test.io'
process.env.GITEA_TOKEN = 'test-token'
process.env.GITEA_USER = 'testuser'

// Global test utilities
global.fetch = vi.fn()
