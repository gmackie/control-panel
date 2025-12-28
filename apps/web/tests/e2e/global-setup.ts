/**
 * Playwright Global Setup
 * 
 * Runs once before all tests to prepare the test environment
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...');
  
  // Get the base URL from the first project
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  
  // Wait for the dev server to be ready
  const maxRetries = 30;
  const retryDelay = 2000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${baseURL}/api/health`);
      if (response.ok) {
        console.log('Server is ready');
        break;
      }
    } catch (error) {
      console.log(`Waiting for server... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  // Optional: Set up authentication state
  // This creates a storageState file that can be reused across tests
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // If authentication is needed, handle it here
    // For GitHub OAuth, we might need to mock the auth or use test credentials
    
    // Save authentication state for reuse in tests
    await context.storageState({ path: './tests/e2e/auth-state.json' });
    
    console.log('Authentication state saved');
  } catch (error) {
    console.log('Could not set up auth state:', error);
    // Continue without auth state - tests may need to handle auth individually
  } finally {
    await browser.close();
  }

  console.log('Global setup complete');
}

export default globalSetup;
