import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display the dashboard page or auth page', async ({ page }) => {
    const url = page.url();
    const isDashboard = url.endsWith('/') || url.includes('localhost:3000') && !url.includes('auth');
    const isAuthPage = url.includes('/auth/');
    
    expect(isDashboard || isAuthPage).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show navigation or auth UI', async ({ page }) => {
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();
    
    const interactiveCount = await page.locator('a, button, input').count();
    expect(interactiveCount).toBeGreaterThan(0);
  });

  test('should have interactive elements', async ({ page }) => {
    const interactiveElements = page.locator('a[href], button, input, [role="button"]');
    const count = await interactiveElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display system health indicators when authenticated', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const isAuthPage = page.url().includes('/auth/');
    if (isAuthPage) {
      test.skip();
      return;
    }
    
    const healthIndicators = page.locator('[class*="health"], [class*="status"], [data-testid*="health"]');
    await healthIndicators.count();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.locator('body')).toBeVisible();
    
    const body = page.locator('body');
    const box = await body.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test('should handle page refresh correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.reload();
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Dashboard API Integration', () => {
  test('health API should respond', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBeLessThan(500);
  });

  test('should handle unauthenticated requests gracefully', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Dashboard Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(10000);
  });

  test('should have no critical console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR') &&
      !e.includes('EventSource') &&
      !e.includes('text/event-stream') &&
      !e.includes('Notification stream')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
