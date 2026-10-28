import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-0123456789', LOG_LEVEL: 'silent' },
  },
})
