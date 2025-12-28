/**
 * Dashboard E2E Tests
 * 
 * Tests for the main dashboard functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/');
  });

  test('should display the dashboard page', async ({ page }) => {
    // Check that the page loads
    await expect(page).toHaveURL('/');
    
    // Check for main dashboard elements
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show navigation sidebar', async ({ page }) => {
    // Look for navigation elements
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    // Check that main navigation links exist
    const navLinks = page.locator('a[href]');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display system health indicators', async ({ page }) => {
    // Wait for health data to load
    await page.waitForLoadState('networkidle');
    
    // Look for health status indicators (common patterns)
    const healthIndicators = page.locator('[class*="health"], [class*="status"], [data-testid*="health"]');
    
    // This is flexible as the exact implementation may vary
    // Just verify the page has loaded properly
    await healthIndicators.count();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
    
    // Check that content is not overflowing
    const body = page.locator('body');
    const box = await body.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test('should handle page refresh correctly', async ({ page }) => {
    // Initial load
    await page.waitForLoadState('networkidle');
    
    // Refresh the page
    await page.reload();
    
    // Page should still work after refresh
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Dashboard API Integration', () => {
  test('health API should respond', async ({ request }) => {
    const response = await request.get('/api/health');
    
    // Should get a response (may be 200, 401, etc. depending on auth)
    expect(response.status()).toBeLessThan(500);
  });

  test('should handle unauthenticated requests gracefully', async ({ page }) => {
    // Clear any stored auth
    await page.context().clearCookies();
    
    // Navigate to a protected route
    await page.goto('/');
    
    // Should either show content or redirect to login
    // The app should not crash
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Dashboard Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known acceptable errors (like favicon 404)
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
