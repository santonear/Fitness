import { describe, it, expect } from 'vitest';
import { readFeatureFlags, readPublicFeatureFlags } from '../../src/backend/feature-config';
import type { AdminDatabase } from '../../src/backend/admin/core/contracts';
describe('admin console feature gate', () => {
  it('publishes the environment default so the authorized shell can mount', async () => {
    expect(await readPublicFeatureFlags({ FITNESS_FEATURE_FLAGS: '{}', ADMIN_CONSOLE_ENABLED: 'true' })).toEqual({
      adminConsole: true,
    });
  });
  it('honors a managed kill switch in both server and public reads', async () => {
    const db = {
      prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ name: 'adminConsole', enabled: 0 }] }) }) }),
    } as unknown as AdminDatabase;
    const env = {
      FITNESS_FEATURE_FLAGS: '{}',
      ADMIN_CONSOLE_ENABLED: 'true',
      ADMIN_ENVIRONMENT: 'preview' as const,
      ADMIN_DB: db,
    };
    expect((await readPublicFeatureFlags(env)).adminConsole).toBe(false);
    expect((await readFeatureFlags(env)).adminConsole).toBe(false);
  });
});
