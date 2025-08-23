const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const customConfig = {
  displayName: 'api',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/app/api/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/app/api/**/?(*.)+(test|spec).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/src/app/api/__tests__/webhooks.test.ts',
  ],
}

module.exports = createJestConfig(customConfig)
