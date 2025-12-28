export const GitHubOAuth = {
  getSession: jest.fn().mockResolvedValue({
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@gmac.io',
      login: 'testuser'
    },
    authenticated: true,
    expires: new Date(Date.now() + 86400000).toISOString()
  }),
  
  verifySession: jest.fn().mockResolvedValue({
    valid: true,
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@gmac.io'
    }
  }),
  
  signOut: jest.fn().mockResolvedValue({
    success: true,
    message: 'Signed out successfully'
  })
};