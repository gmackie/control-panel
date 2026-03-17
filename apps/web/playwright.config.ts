import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const port = process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? '3000'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? `PORT=${port} npm run dev`

export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Global test timeout */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER
      ? process.env.PLAYWRIGHT_REUSE_SERVER === 'true'
      : !process.env.CI,
    timeout: 120000,
  },

  /* Test match patterns */
  testMatch: /.*\.e2e\.spec\.ts/,

  /* Global setup and teardown */
  globalSetup: resolve(__dirname, './tests/e2e/global-setup.ts'),
  globalTeardown: resolve(__dirname, './tests/e2e/global-teardown.ts'),

  /* Output directories */
  outputDir: 'test-results/',

  /* Expect settings */
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 5000,

    /* Threshold for pixel tests */
    toHaveScreenshot: {
      threshold: 0.2,
    },
  },

  /* Test timeout */
  timeout: 30000,

  /* Maximum failures */
  maxFailures: process.env.CI ? 10 : undefined,
})
