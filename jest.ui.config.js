const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const customConfig = {
  displayName: 'ui',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/components/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/components/**/?(*.)+(test|spec).{js,jsx,ts,tsx}',
    // Keep UI scope minimal for stability initially
    '<rootDir>/src/components/__tests__/monitoring-dashboard.test.tsx',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
  ],
}

module.exports = createJestConfig(customConfig)

