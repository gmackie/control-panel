// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to silence console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Browser-only mocks for JSDOM
if (typeof window !== 'undefined') {
  // Mock IntersectionObserver
  global.IntersectionObserver = jest.fn(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }))

  // Mock ResizeObserver
  global.ResizeObserver = jest.fn(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }))

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock EventSource for SSE testing
global.EventSource = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
}))

// Note: MSW setup is disabled in unit tests to avoid
// Node/WHATWG fetch polyfill complexity in JSDOM.
// If you need MSW, import and start the server in specific tests.
