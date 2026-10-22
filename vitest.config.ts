import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Bound concurrent module graphs on local machines and CI. Engine tests build whole plans and
  // shared runners vary about 2x in speed, so the per-test timeout is 20 s instead of 5 s.
  test: { maxWorkers: 2, testTimeout: 20000, include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'] },
});
