import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __DEV__: 'true' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
})
