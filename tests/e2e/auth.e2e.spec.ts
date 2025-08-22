import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page
    await page.goto('/')
  })

  test('should redirect unauthenticated users to sign in', async ({ page }) => {
    // Should be redirected to sign in page
    await expect(page).toHaveURL(/\/auth\/signin/)
    
    // Should show sign in form
    await expect(page.locator('h1')).toContainText('Sign in')
    await expect(page.locator('text=Continue with GitHub')).toBeVisible()
  })

  test('should display GitHub OAuth button', async ({ page }) => {
    await page.goto('/auth/signin')
    
    const githubButton = page.locator('button:has-text("Continue with GitHub")')
    await expect(githubButton).toBeVisible()
    await expect(githubButton).toBeEnabled()
  })

  test('should handle OAuth callback URL', async ({ page }) => {
    // Mock successful OAuth callback
    await page.goto('/api/oauth2/callback?code=test-code&state=test-state')
    
    // Should handle the callback (might redirect or show processing)
    await expect(page).not.toHaveURL(/\/auth\/signin/)
  })

  test('should show error page for OAuth errors', async ({ page }) => {
    await page.goto('/auth/error?error=AccessDenied')
    
    await expect(page.locator('h1')).toContainText('Authentication Error')
    await expect(page.locator('text=Access Denied')).toBeVisible()
    await expect(page.locator('a:has-text("Try again")')).toBeVisible()
  })

  test('should handle session timeout', async ({ page, context }) => {
    // Set up a session that will expire
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'expired-token',
        domain: 'localhost',
        path: '/',
        expires: Date.now() - 1000 // Expired
      }
    ])

    await page.goto('/dashboard')
    
    // Should redirect to sign in due to expired session
    await expect(page).toHaveURL(/\/auth\/signin/)
  })

  test('should allow sign out', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    await page.goto('/dashboard')
    
    // Find and click sign out button (might be in a menu)
    await page.locator('[data-testid="user-menu"]').click()
    await page.locator('text=Sign out').click()
    
    // Should redirect to sign in page
    await expect(page).toHaveURL(/\/auth\/signin/)
  })

  test('should maintain authentication state across page refreshes', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    await page.goto('/dashboard')
    await page.reload()
    
    // Should remain on dashboard after refresh
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('should handle multiple tabs with same session', async ({ browser }) => {
    const context = await browser.newContext()
    
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    const page1 = await context.newPage()
    const page2 = await context.newPage()

    await page1.goto('/dashboard')
    await page2.goto('/applications')

    // Both pages should be accessible
    await expect(page1.locator('h1:has-text("Dashboard")')).toBeVisible()
    await expect(page2.locator('h1:has-text("Applications")')).toBeVisible()

    await context.close()
  })

  test('should protect API endpoints', async ({ page }) => {
    // Try to access protected API without authentication
    const response = await page.request.get('/api/monitoring/metrics')
    expect(response.status()).toBe(401)
  })

  test('should allow access to API endpoints when authenticated', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    // Try to access protected API with authentication
    const response = await page.request.get('/api/monitoring/metrics')
    expect(response.status()).toBe(200)
  })
})

test.describe('Authentication Security', () => {
  test('should prevent CSRF attacks', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    // Try to make a POST request without CSRF token
    const response = await page.request.post('/api/auth/signout', {
      data: {}
    })

    // Should be rejected due to missing CSRF token
    expect([403, 400]).toContain(response.status())
  })

  test('should sanitize OAuth callback parameters', async ({ page }) => {
    // Try OAuth callback with malicious parameters
    const maliciousParams = 'code=test&state=<script>alert("xss")</script>'
    await page.goto(`/api/oauth2/callback?${maliciousParams}`)

    // Should not execute script or show unsanitized content
    const content = await page.content()
    expect(content).not.toContain('<script>')
    expect(content).not.toContain('alert("xss")')
  })

  test('should handle invalid OAuth states', async ({ page }) => {
    await page.goto('/api/oauth2/callback?code=test&state=invalid-state')
    
    // Should handle invalid state gracefully
    await expect(page).toHaveURL(/\/auth\/error/)
  })

  test('should validate session tokens', async ({ page, context }) => {
    // Set invalid session token
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'invalid.token.format',
        domain: 'localhost',
        path: '/'
      }
    ])

    await page.goto('/dashboard')
    
    // Should redirect to sign in due to invalid token
    await expect(page).toHaveURL(/\/auth\/signin/)
  })
})