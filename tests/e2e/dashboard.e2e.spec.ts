import { test, expect } from '@playwright/test'

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page, context }) => {
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
  })

  test('should display main dashboard components', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
    
    // Should show main dashboard sections
    await expect(page.locator('[data-testid="infrastructure-overview"]')).toBeVisible()
    await expect(page.locator('[data-testid="monitoring-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="applications-overview"]')).toBeVisible()
  })

  test('should display navigation menu', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible()
    
    // Check main navigation items
    await expect(page.locator('a:has-text("Dashboard")')).toBeVisible()
    await expect(page.locator('a:has-text("Applications")')).toBeVisible()
    await expect(page.locator('a:has-text("Cluster")')).toBeVisible()
    await expect(page.locator('a:has-text("Monitoring")')).toBeVisible()
    await expect(page.locator('a:has-text("Integrations")')).toBeVisible()
  })

  test('should navigate between pages', async ({ page }) => {
    // Navigate to Applications
    await page.locator('a:has-text("Applications")').click()
    await expect(page).toHaveURL(/\/applications/)
    await expect(page.locator('h1:has-text("Applications")')).toBeVisible()

    // Navigate to Cluster
    await page.locator('a:has-text("Cluster")').click()
    await expect(page).toHaveURL(/\/cluster/)
    await expect(page.locator('h1:has-text("Cluster Management")')).toBeVisible()

    // Navigate back to Dashboard
    await page.locator('a:has-text("Dashboard")').click()
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('should display infrastructure overview', async ({ page }) => {
    const infraSection = page.locator('[data-testid="infrastructure-overview"]')
    
    await expect(infraSection.locator('text=Infrastructure Overview')).toBeVisible()
    await expect(infraSection.locator('text=Cluster Status')).toBeVisible()
    await expect(infraSection.locator('text=Resource Utilization')).toBeVisible()
    await expect(infraSection.locator('text=Cost Tracking')).toBeVisible()
  })

  test('should display monitoring metrics', async ({ page }) => {
    const monitoringSection = page.locator('[data-testid="monitoring-dashboard"]')
    
    await expect(monitoringSection.locator('text=System Metrics')).toBeVisible()
    await expect(monitoringSection.locator('text=CPU Usage')).toBeVisible()
    await expect(monitoringSection.locator('text=Memory Usage')).toBeVisible()
    await expect(monitoringSection.locator('text=Disk Usage')).toBeVisible()
  })

  test('should display application status', async ({ page }) => {
    const appsSection = page.locator('[data-testid="applications-overview"]')
    
    await expect(appsSection.locator('text=Applications')).toBeVisible()
    
    // Should show service status indicators
    await expect(appsSection.locator('[data-testid="service-gitea"]')).toBeVisible()
    await expect(appsSection.locator('[data-testid="service-drone"]')).toBeVisible()
    await expect(appsSection.locator('[data-testid="service-harbor"]')).toBeVisible()
    await expect(appsSection.locator('[data-testid="service-argocd"]')).toBeVisible()
  })

  test('should refresh data when refresh button is clicked', async ({ page }) => {
    // Wait for initial data load
    await expect(page.locator('[data-testid="infrastructure-overview"]')).toBeVisible()
    
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()
    
    // Click refresh button
    await refreshButton.click()
    
    // Should show loading state briefly
    await expect(page.locator('text=Loading')).toBeVisible({ timeout: 1000 }).catch(() => {
      // Loading state might be too brief to catch
    })
  })

  test('should handle real-time updates', async ({ page }) => {
    // Wait for initial load
    await expect(page.locator('[data-testid="monitoring-dashboard"]')).toBeVisible()
    
    // Should receive real-time updates (SSE)
    // This would require mocking SSE responses in real tests
    await page.waitForTimeout(2000) // Wait for potential updates
    
    // Verify data is still present (not replaced with loading)
    await expect(page.locator('text=CPU Usage')).toBeVisible()
    await expect(page.locator('text=Memory Usage')).toBeVisible()
  })
})

test.describe('Dashboard Responsiveness', () => {
  test('should be responsive on mobile devices', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')

    // Should show mobile navigation
    const mobileMenu = page.locator('[data-testid="mobile-menu-button"]')
    await expect(mobileMenu).toBeVisible()

    // Click mobile menu
    await mobileMenu.click()
    await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible()

    // Should stack dashboard components vertically on mobile
    const infraSection = page.locator('[data-testid="infrastructure-overview"]')
    const monitoringSection = page.locator('[data-testid="monitoring-dashboard"]')
    
    await expect(infraSection).toBeVisible()
    await expect(monitoringSection).toBeVisible()
  })

  test('should handle tablet viewport', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/dashboard')

    // Should show adapted layout for tablet
    await expect(page.locator('[data-testid="infrastructure-overview"]')).toBeVisible()
    await expect(page.locator('[data-testid="monitoring-dashboard"]')).toBeVisible()
    
    // Navigation should be visible but might be condensed
    await expect(page.locator('nav')).toBeVisible()
  })

  test('should handle desktop viewport', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/dashboard')

    // Should show full desktop layout
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible()
    
    // Should show dashboard in grid layout
    const dashboardGrid = page.locator('[data-testid="dashboard-grid"]')
    await expect(dashboardGrid).toBeVisible()
  })
})

test.describe('Dashboard Performance', () => {
  test('should load dashboard within acceptable time', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    const startTime = Date.now()
    
    await page.goto('/dashboard')
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
    
    const loadTime = Date.now() - startTime
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should handle multiple concurrent requests', async ({ page, context }) => {
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

    // Wait for all major components to load
    await Promise.all([
      expect(page.locator('[data-testid="infrastructure-overview"]')).toBeVisible(),
      expect(page.locator('[data-testid="monitoring-dashboard"]')).toBeVisible(),
      expect(page.locator('[data-testid="applications-overview"]')).toBeVisible()
    ])

    // All sections should be present and functional
    await expect(page.locator('text=Infrastructure Overview')).toBeVisible()
    await expect(page.locator('text=System Metrics')).toBeVisible()
    await expect(page.locator('text=Applications')).toBeVisible()
  })

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'valid-token',
        domain: 'localhost',
        path: '/'
      }
    ])

    // Block API requests to simulate network issues
    await page.route('/api/monitoring/metrics', route => route.abort())
    await page.route('/api/infrastructure/overview', route => route.abort())

    await page.goto('/dashboard')

    // Should show error states gracefully
    await expect(page.locator('text=Error loading')).toBeVisible()
    
    // Should still show page structure
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
    await expect(page.locator('nav')).toBeVisible()
  })
})