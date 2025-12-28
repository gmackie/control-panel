/**
 * Playwright Global Teardown
 * 
 * Runs once after all tests complete to clean up the test environment
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(_config: FullConfig) {
  console.log('Starting global teardown...');

  // Clean up auth state file
  const authStatePath = './tests/e2e/auth-state.json';
  try {
    if (fs.existsSync(authStatePath)) {
      fs.unlinkSync(authStatePath);
      console.log('Cleaned up auth state file');
    }
  } catch (error) {
    console.log('Could not clean up auth state:', error);
  }

  // Clean up any test artifacts if needed
  const testArtifactsDir = path.join(process.cwd(), 'test-results');
  
  // Keep test results but log completion
  if (fs.existsSync(testArtifactsDir)) {
    const files = fs.readdirSync(testArtifactsDir);
    console.log(`Test artifacts: ${files.length} items in ${testArtifactsDir}`);
  }

  console.log('Global teardown complete');
}

export default globalTeardown;
