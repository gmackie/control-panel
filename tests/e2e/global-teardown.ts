import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...')

  // Cleanup test data if needed
  console.log('🗑️ Cleaning up test data...')
  
  // You can add any global cleanup here like:
  // - Removing test users
  // - Cleaning database
  // - Stopping mock services
  
  console.log('✅ Global teardown completed')
}

export default globalTeardown