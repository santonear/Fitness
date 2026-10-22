import { it, expect } from 'vitest';
import { substituteItem } from '../../../src/engine/operations';
import { createContext } from '../../../src/engine/pipeline';
import { prescribe } from '../../../src/engine/dose';
import { fixtureProfile } from './fixtures';
it.each([true, false])('keeps replacement source identity only when supplied (hasSource=%s)', hasSource => {
  const p = {
      ...fixtureProfile,
      level: 'intermediate' as const,
      trainingAgeWeeks: 52,
      equipment: ['none', 'dumbbell'] as typeof fixtureProfile.equipment,
    },
    ctx = createContext(p),
    r = ctx.rules,
    e = r.data.exercises.find(e => e.primary_pattern === 'carry' && e.equipment_required.includes('dumbbell'))!,
    item = prescribe(e, p, r, ctx.gate.restrictions, 'accessory', 2);
  if (hasSource) Object.assign(item.prescription!, { sourcePosition: 'day-fixture-M1-main_2', goalRole: 'accessory' });
  else {
    delete item.prescription!.sourcePosition;
    delete item.prescription!.goalRole;
  }
  const before = structuredClone(item),
    out = substituteItem(item, p, 'dislike', r);
  expect(out.noop).toBe(false);
  expect(out.value).toMatchObject({ prescription: { block: 'accessory' } });
  expect((out.value as typeof item).prescription?.sourcePosition).toBe(hasSource ? 'day-fixture-M1-main_2' : undefined);
  expect((out.value as typeof item).prescription?.goalRole).toBe(hasSource ? 'accessory' : undefined);
  expect(out.diff[0].before).toEqual(before);
  expect(out.diff[0].after).toEqual(out.value);
  expect(item).toEqual(before);
});
it('prescribes a strength accessory dose while retaining its main source container', () => {
  const p = {
      ...fixtureProfile,
      goal: 'strength' as const,
      level: 'intermediate' as const,
      trainingAgeWeeks: 52,
      daysPerWeek: 2,
    },
    ctx = createContext(p),
    r = ctx.rules,
    e = r.data.exercises.find(e => e.slug === 'custom-self-resisted-chest-press')!,
    item = prescribe(e, p, r, ctx.gate.restrictions, 'accessory', 2);
  Object.assign(item.prescription!, { block: 'main', sourcePosition: 'day-semantic-M1-main_3', goalRole: 'accessory' });
  const before = structuredClone(item),
    out = substituteItem(item, p, 'dislike', r),
    range = r.get('goal.params.strength').accessory.reps;
  expect(out.noop).toBe(false);
  expect('reps' in out.value.target).toBe(true);
  if (!('reps' in out.value.target)) throw Error('Expected strength repetitions');
  expect(out.value.target.reps).toBeGreaterThanOrEqual(range[0]);
  expect(out.value.target.reps).toBeLessThanOrEqual(range[1]);
  expect((out.value as typeof item).prescription).toMatchObject({
    block: 'main',
    sourcePosition: before.prescription!.sourcePosition,
    goalRole: 'accessory',
  });
  expect(item).toEqual(before);
});
