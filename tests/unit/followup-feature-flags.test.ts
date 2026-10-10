import { afterEach, expect, test, vi } from 'vitest';
import { featureNames, parseFeatureFlags } from '../../src/domain/feature-flags';
import { isFeatureEnabled, refreshFeatureFlags } from '../../src/application/feature-flags';
afterEach(() => vi.useRealTimers());
test('all features default off, unknown keys and truthy strings cannot enable', () => {
  expect(Object.values(parseFeatureFlags(undefined)).every(v => !v)).toBe(true);
  expect(parseFeatureFlags('{invalid')).toEqual(parseFeatureFlags(null));
  expect(parseFeatureFlags({ nutrition: 'true', activityImport: true, admin: true })).toEqual({ ...parseFeatureFlags(null), activityImport: true });
  expect(Object.keys(parseFeatureFlags({}))).toEqual([...featureNames]);
});
test('remote disable, expiry and request failure close features without local override', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
  const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: 1, flags: { nutrition: true }, expiresAt: Date.now() + 60_000 })));
  await refreshFeatureFlags(transport); expect(isFeatureEnabled('nutrition')).toBe(true);
  expect(transport.mock.calls[0][1].credentials).toBe('omit');
  vi.advanceTimersByTime(60_001); expect(isFeatureEnabled('nutrition')).toBe(false);
  await refreshFeatureFlags(vi.fn().mockRejectedValue(new Error('offline'))); expect(isFeatureEnabled('nutrition')).toBe(false);
  await refreshFeatureFlags(vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: 1, flags: {}, expiresAt: Date.now() + 60_000 }))));
  expect(isFeatureEnabled('nutrition')).toBe(false);
});
