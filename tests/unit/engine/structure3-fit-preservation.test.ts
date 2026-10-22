import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { scorePlan, marginal } from '../../../src/engine/score';
import { prescribe } from '../../../src/engine/dose';
import { createContext, generatePlan } from '../../../src/engine/pipeline';
import { buildWeek } from '../../../src/engine/structure';
import { buildSlots } from '../../../src/engine/skeleton';
import { retainsRequirements, fitDuration } from '../../../src/engine/fit';
import { baseProfile, sampledProfiles } from '../../../tools/eval/training-engine-profiles';
import { planFixture } from './fixtures';
const rules = new Rules(),
  p = baseProfile({ level: 'intermediate', daysPerWeek: 3 }),
  ctx = createContext(p);
const item = (pattern: string, block: 'main' | 'accessory' | 'cooldown' = 'accessory') =>
  prescribe(
    rules.data.exercises.find(e => e.primary_pattern === pattern && e.modality !== 'power')!,
    p,
    rules,
    ctx.gate.restrictions,
    block,
    2,
  );
it('computes removal gain exactly as fresh scoring without mutating the input', () => {
  const plan = {
      ...planFixture(),
      templates: [
        {
          id: 'remove',
          name: 'fixture',
          estimatedMinutes: 30,
          items: [item('squat', 'main'), item('pull_horizontal'), item('anti_extension')],
        },
      ],
    },
    before = structuredClone(plan);
  for (let index = 0; index < plan.templates[0].items.length; index++) {
    const next = structuredClone(plan);
    next.templates[0].items.splice(index, 1);
    expect(marginal(plan, { kind: 'remove', templateId: 'remove', itemIndex: index }, p, rules)).toBeCloseTo(
      scorePlan(next, p, rules).quality - scorePlan(plan, p, rules).quality,
      12,
    );
  }
  expect(plan).toEqual(before);
  expect(marginal(plan, { kind: 'remove', templateId: 'remove', itemIndex: -1 }, p, rules)).toBe(0);
});
it('retains the last required pattern but allows removal when another day still covers it', () => {
  const pull = item('pull_horizontal'),
    core = item('anti_extension'),
    before = { id: 'current', items: [pull, core] },
    after = { id: 'current', items: [core] };
  expect(retainsRequirements(before, after, ctx)).toBe(false);
  expect(
    retainsRequirements(before, after, {
      ...ctx,
      plan: {
        ...planFixture(),
        templates: [{ id: 'other', name: 'other', estimatedMinutes: 30, items: [structuredClone(pull)] }],
      },
    }),
  ).toBe(true);
});
it.each([1, 2, 3, 6])('makes older balance slots nonoptional for %i available days', days => {
  const p = baseProfile({
      daysPerWeek: days,
      population: { kind: 'older_adult', fallsAnswers: [false, false, false, false] },
      birthYearMonth: '1956-06',
    }),
    ctx = createContext(p);
  for (const day of buildWeek(p, ctx.gate, rules).days.filter(day => day.balanceRequired))
    expect(
      buildSlots(day, p, day.minutes, rules)
        .filter(slot => slot.patterns.includes('balance'))
        .every(slot => !slot.optional),
    ).toBe(true);
});
it('preserves balance for the diagnosed one-day older profile without changing the profile', () => {
  const p = sampledProfiles(80)[13],
    before = structuredClone(p),
    plan = generatePlan(p);
  expect(p.population.kind).toBe('older_adult');
  expect(p.daysPerWeek).toBe(1);
  expect(
    plan.templates.some(t => t.items.some(i => rules.byExercise.get(i.exerciseId)?.primary_pattern === 'balance')),
  ).toBe(true);
  expect(p).toEqual(before);
});
it('places a required older balance slot before conditioning and cooldown', () => {
  const profile = baseProfile({
      sessionMinutes: 45,
      daysPerWeek: 3,
      population: { kind: 'older_adult', fallsAnswers: [false, false, false, false] },
      birthYearMonth: '1956-06',
    }),
    context = createContext(profile);
  for (const day of buildWeek(profile, context.gate, rules).days) {
    const slots = buildSlots(day, profile, day.minutes, rules),
      balance = slots.findIndex(slot => slot.role === 'balance'),
      tail = slots.findIndex(slot => ['conditioning', 'cooldown', 'mobility'].includes(slot.role));
    if (balance >= 0 && tail >= 0) expect(balance).toBeLessThan(tail);
  }
});
it('inserts new conditioning before an existing cooldown rather than appending after it', () => {
  const profile = { ...p, sessionMinutes: 30 },
    ctx = createContext(profile),
    cooldown = prescribe(
      rules.data.exercises.find(e => e.mobility_type === 'static')!,
      profile,
      rules,
      ctx.gate.restrictions,
      'cooldown',
      1,
    ),
    session = { id: 'order', name: 'order', estimatedMinutes: 30, slots: [], items: [item('squat', 'main'), cooldown] },
    result = fitDuration(session, 30, ctx),
    first = result.items.findIndex(i => i.prescription?.block === 'cooldown');
  expect(first).toBeGreaterThanOrEqual(0);
  expect(result.items.slice(first).every(i => i.prescription?.block === 'cooldown')).toBe(true);
});
