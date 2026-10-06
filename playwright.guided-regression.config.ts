import { defineConfig } from '@playwright/test';
import guided from './playwright.guided.config';

export default defineConfig({ ...guided,
  testMatch: ['vis.spec.ts', 'workouts.spec.ts', 'workout-backup.spec.ts', 'timer.spec.ts',
    'backup.spec.ts', 'persistence.spec.ts', 'cal-backup.spec.ts', 'cal-safety.spec.ts'],
  outputDir: './test-results-guided-regression',
});
