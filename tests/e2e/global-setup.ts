import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...')

  const browser = await chromium.launch()
  const page = await browser.newPage()

  // Wait for the application to be ready
  console.log('⏳ Waiting for application to be ready...')
  try {
    await page.goto(config.projects[0].use.baseURL || 'http://localhost:3000')
    await page.waitForSelector('body', { timeout: 30000 })
    console.log('✅ Application is ready')
  } catch (error) {
    console.error('❌ Application failed to start:', error)
    throw error
  }

  // Setup test data if needed
  console.log('📝 Setting up test data...')
  
  // You can add any global setup here like:
  // - Creating test users
  // - Seeding database
  // - Setting up mock services
  
  await browser.close()
  console.log('✅ Global setup completed')
}

export default globalSetup