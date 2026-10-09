import migration from './v8-migration.config';
export default { ...migration, testMatch: ['backup.spec.ts', 'cal-backup.spec.ts', 'guided-backup.spec.ts', 'workout-backup.spec.ts'], outputDir: '../../.cache/v8-backup-regression-results' };
