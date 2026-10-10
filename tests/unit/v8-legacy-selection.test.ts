import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import type { Plan, PlanVersion, WorkoutSession } from '../../src/domain/models';
import { utcTimestampSchema } from '../../src/domain/schemas';
import { legacyTrainingSeconds, selectLegacyCurrentPlan } from '../../src/domain/v8/legacy-selection';

const sample = validateBackupEnvelope(JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-plans-weight.json', import.meta.url), 'utf8'))).data;
const plan = (id: string, createdAt: string, status: Plan['status'] = 'draft'): Plan => ({ ...sample.plans[0], id, createdAt, status });
const version = (planId: string): PlanVersion => ({ ...sample.planVersions[0], id: `version-${planId}`, planId });
const session = (planId: string, startedAt: string, status: WorkoutSession['status'] = 'completed'): WorkoutSession => ({ ...sample.sessions[0], planVersionId: `version-${planId}`, startedAt, status });
const first = '2026-01-01T00:00:00.000Z';
const second = '2026-02-01T00:00:00.000Z';
const third = '2026-03-01T00:00:00.000Z';

describe('approved legacy current-plan ranking', () => {
  it('keeps active and in-progress in one priority group, before other recent training', () => {
    const plans = [plan('a', first, 'active'), plan('b', first), plan('c', third)];
    const versions = plans.map(row => version(row.id));
    const sessions = [session('a', first), session('b', second, 'in_progress'), session('c', third)];
    expect(selectLegacyCurrentPlan(plans, versions, sessions)?.id).toBe('b');
    sessions[0].startedAt = third;
    expect(selectLegacyCurrentPlan(plans, versions, sessions)?.id).toBe('a');
  });
  it('uses latest training before creation time when neither plan has priority', () => {
    const plans = [plan('a', third), plan('b', first)];
    expect(selectLegacyCurrentPlan(plans, plans.map(row => version(row.id)), [session('a', first), session('b', second)])?.id).toBe('b');
  });
  it('uses creation time without training and a stable ID for exact ties', () => {
    const plans = [plan('b', second), plan('a', second), plan('c', first)];
    expect(selectLegacyCurrentPlan(plans, [], [])?.id).toBe('a');
    expect(selectLegacyCurrentPlan([...plans].reverse(), [], [])?.id).toBe('a');
    expect(selectLegacyCurrentPlan([], [], [])).toBeUndefined();
  });
  it('compares timestamp instants rather than different ISO fraction spellings', () => {
    const plans = [plan('a', first), plan('b', first)];
    expect(utcTimestampSchema.safeParse('2026-01-01T00:00:00Z').success).toBe(true);
    expect(utcTimestampSchema.safeParse('2026-01-01T00:00:00.001Z').success).toBe(true);
    expect(selectLegacyCurrentPlan(plans, plans.map(row => version(row.id)), [session('a', '2026-01-01T00:00:00Z'), session('b', '2026-01-01T00:00:00.001Z')])?.id).toBe('b');
    plans[1].createdAt = '2026-01-01T00:00:00Z';
    expect(selectLegacyCurrentPlan(plans, [], [])?.id).toBe('a');
  });
  it('does not resurrect deleted plans or attach unlinked training to another plan', () => {
    const plans = [plan('a', first), { ...plan('b', second, 'active'), deletedAt: third }];
    expect(selectLegacyCurrentPlan(plans, [], [session('unknown', third, 'in_progress')])?.id).toBe('a');
  });
  it('preserves real exported identities, versions, history and source ordering', () => {
    const before = structuredClone(sample);
    const result = selectLegacyCurrentPlan(sample.plans, sample.planVersions, sample.sessions);
    expect(sample.plans).toContain(result);
    expect(sample).toEqual(before);
  });
});

describe('legacy elapsed duration statistics', () => {
  it('uses end minus start, including across midnight, with a 12-hour inclusive boundary', () => {
    expect(legacyTrainingSeconds({ startedAt: '2026-01-01T23:50:00Z', completedAt: '2026-01-02T00:20:00Z' })).toBe(1800);
    expect(legacyTrainingSeconds({ startedAt: first, completedAt: first })).toBe(0);
    expect(legacyTrainingSeconds({ startedAt: first, completedAt: '2026-01-01T12:00:00Z' })).toBe(43200);
  });
  it('excludes missing, negative, invalid and over-12-hour elapsed times without changing facts', () => {
    for (const completedAt of [undefined, '2025-12-31T23:59:59Z', 'invalid', '2026-01-01T12:00:01Z']) {
      const original = { startedAt: first, completedAt };
      expect(legacyTrainingSeconds(original)).toBeUndefined();
      expect(original).toEqual({ startedAt: first, completedAt });
    }
  });
});
