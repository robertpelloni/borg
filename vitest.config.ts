import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts', 'packages/**/*.{test,spec}.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/submodules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/submodules/**', '**/*.d.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@aios/core': './packages/core/src',
      '@aios/ui': './packages/ui/src',
    },
  },
});
