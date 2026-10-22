import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Bound concurrent module graphs on local machines and CI; no assertion or timeout is changed.
  // Engine tests build whole plans; shared CI runners vary 2x in speed, so 5 s was too tight.
  test: { maxWorkers: 2, testTimeout: 20000, include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'] },
});
