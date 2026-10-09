import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { migrateLegacyPlans } from '../../src/domain/v8/legacy-plans';
import { emptyGuidedState } from '../../src/domain/guided-contracts';
import { legacyPlanVersionSchema } from '../../src/domain/schemas';

const migratedAt = '2026-10-10T00:00:00.000Z';
const read = (name: string) => validateBackupEnvelope(JSON.parse(readFileSync(new URL(`../fixtures/legacy-backups/${name}.json`, import.meta.url), 'utf8'))).data;

describe('legacy plan migration projection with injected duration estimator', () => {
  for (const name of ['v5-plans-weight', 'v62-plans-weight', 'v71-plans-weight', 'v71-coach-plan', 'v71-onboarding']) {
    it(`projects the real UI backup without changing legacy facts: ${name}`, async () => {
      const source = read(name);
      const before = structuredClone(source);
      const result = await migrateLegacyPlans(source, () => 35, migratedAt);
      expect(result.plans.map(plan => plan.id)).toEqual(source.plans.filter(plan => !plan.deletedAt).map(plan => plan.id));
      expect(new Set(result.versions.map(version => version.id)).size).toBe(result.versions.length);
      expect(new Set(result.versions.map(version => version.planId)).size).toBe(source.plans.filter(plan => !plan.deletedAt).length);
      expect(result.plans.filter(plan => !plan.readOnly)).toHaveLength(source.plans.some(plan => !plan.deletedAt) ? 1 : 0);
      for (const version of result.versions) {
        expect(version.origin).toBe('migrated');
        expect(z.uuid().safeParse(version.id).success).toBe(true);
        expect(source.planVersions.find(original => original.id === version.basedOnVersionId)?.planId).toBe(version.planId);
        expect(version.templates.every(template => template.estimatedMinutes >= 15 && template.estimatedMinutes <= 120)).toBe(true);
      }
      expect(await migrateLegacyPlans(source, () => 35, migratedAt)).toEqual(result);
      expect(source).toEqual(before);
    });
  }
  it('retains legal template durations, uses a legal onboarding slot and leaves absent original words empty', async () => {
    const source = read('v71-coach-plan');
    const estimate = vi.fn(() => 99);
    const result = await migrateLegacyPlans(source, estimate, migratedAt);
    expect(result.versions[0].templates[0].estimatedMinutes).toBe(30);
    expect(result.versions[0].sessionMinutes).toBe(30);
    expect(result.versions[0].scheduleOriginalText).toBe('');
    expect(result.versions[0].changeSummary).toEqual([]);
    expect(estimate).not.toHaveBeenCalled();
  });
  it('deduplicates identical content and duration but retains differing duration as a separate template', async () => {
    const source = read('v71-coach-plan');
    const scheduled = source.scheduledWorkouts[0];
    source.scheduledWorkouts.push({ ...scheduled, id: 'second', durationMinutes: 45 }, { ...scheduled, id: 'third' });
    const result = await migrateLegacyPlans(source, () => 99, migratedAt);
    expect(result.versions[0].templates.map(template => [template.name, template.estimatedMinutes])).toEqual([['A', 30], ['B', 45]]);
  });
  it('records the approved estimation summary and uses the template median when no slot is known', async () => {
    const source = read('v71-coach-plan');
    source.guidedStates = [];
    source.scheduledWorkouts[0].durationMinutes = 1440;
    const result = await migrateLegacyPlans(source, () => 42, migratedAt);
    expect(result.versions[0].sessionMinutes).toBe(42);
    expect(result.versions[0].changeSummary).toEqual(['部分时长按动作估算']);
    expect(source.scheduledWorkouts[0].durationMinutes).toBe(1440);
  });
  it('does not return partial projections when a later legacy plan has lost its current version', async () => {
    const source = read('v71-coach-plan');
    source.plans.push({ ...source.plans[0], id: 'missing-plan', currentVersionId: 'missing-version' });
    const before = structuredClone(source);
    await expect(migrateLegacyPlans(source, () => 30, migratedAt)).rejects.toThrow('Legacy current plan version is missing');
    expect(source).toEqual(before);
  });
  it('does not resurrect deleted plans even as read-only entries, while retaining every original fact', async () => {
    const source = read('v71-coach-plan');
    source.plans[0].deletedAt = migratedAt;
    const before = structuredClone(source);
    expect(await migrateLegacyPlans(source, () => 30, migratedAt)).toEqual({ plans: [], versions: [] });
    expect(source).toEqual(before);
  });
  it('does not attach current global schedule words to independent historical plans of different origins', async () => {
    const source = read('v71-coach-plan');
    const original = source.planVersions[0];
    source.plans.push({ ...source.plans[0], id: 'manual-plan', source: 'manual', currentVersionId: 'manual-version' });
    source.planVersions.push({ ...original, id: 'manual-version', planId: 'manual-plan' });
    source.guidedStates = [{ ...emptyGuidedState(), onboarding: { id: source.plans[0].id, step: 0, answers: { schedule: { status: 'answered', value: 'Only now I can exercise for 90 minutes' } }, completed: false, updatedAt: migratedAt } }];
    const before = structuredClone(source);
    expect((await migrateLegacyPlans(source, () => 30, migratedAt)).versions.map(version => version.scheduleOriginalText)).toEqual(['', '']);
    expect(source).toEqual(before);
  });
  it('averages fully expanded period-plan days over the actual durationWeeks and keeps a separate date-day plan at one', async () => {
    const source = read('v71-coach-plan');
    expect((await migrateLegacyPlans(source, () => 30, migratedAt)).versions[0].weeklyTarget).toBe(1);
    const original = source.planVersions[0];
    if ('durationWeeks' in original) throw new Error('Expected a real date-day fixture');
    const { model: _model, days: _days, ...common } = original;
    const period = legacyPlanVersionSchema.parse({ ...common, durationWeeks: 4, daysPerWeek: 3,
      days: Array.from({ length: 12 }, (_, index) => ({ dayId: crypto.randomUUID(), weekIndex: Math.floor(index / 3) + 1, dayOfWeek: index % 3 + 1, exercises: original.days[0].exercises })),
    });
    source.planVersions = [period];
    expect((await migrateLegacyPlans(source, () => 30, migratedAt)).versions[0].weeklyTarget).toBe(3);
  });
});
