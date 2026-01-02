import { vi } from 'vitest'

export const GitHubOAuth = {
  getSession: vi.fn().mockResolvedValue({
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@gmac.io',
      login: 'testuser'
    },
    authenticated: true,
    expires: new Date(Date.now() + 86400000).toISOString()
  }),
  
  verifySession: vi.fn().mockResolvedValue({
    valid: true,
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@gmac.io'
    }
  }),
  
  signOut: vi.fn().mockResolvedValue({
    success: true,
    message: 'Signed out successfully'
  })
};
