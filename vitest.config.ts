import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Bound concurrent module graphs on local machines and CI; no assertion or timeout is changed.
  test: { maxWorkers: 2, include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'] },
});
