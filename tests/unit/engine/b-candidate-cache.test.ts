import { it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { candidatesFor, isHardEligible } from '../../../src/engine/candidates';
import { createContext } from '../../../src/engine/pipeline';
import { Rules } from '../../../src/engine/data';
import type { PipelineContext, Slot } from '../../../src/engine/contracts';
import { typicalProfiles } from './fixtures';
const slot: Slot = {
  id: 'cache',
  role: 'accessory',
  patterns: ['push_horizontal'],
  priority: 1,
  optional: false,
  sourceRuleId: 'select.pipeline',
};
/** The pre-cache algorithm is retained here as an independent output and timing reference. */
function uncached(ctx: PipelineContext) {
  const safe = ctx.rules.data.exercises.filter(
    e =>
      !ctx.usedIds.has(e.id) &&
      (!e.ladder.id || !ctx.usedLadders.has(e.ladder.id)) &&
      isHardEligible(e, ctx.profile, ctx.gate, ctx),
  );
  const uses = ctx.rules.get('select.use_tag.slot_match').accessory_slot_requires.use,
    role = safe.filter(e => e.use.some(u => uses.includes(u))),
    exact = role.filter(e => slot.patterns.includes(e.primary_pattern)),
    secondary = role.filter(e => e.secondary_patterns.some(p => slot.patterns.includes(p))),
    pool = exact.length ? exact : secondary.length ? secondary : role.length ? role : safe;
  ctx.trace.push({
    ruleId: exact.length ? 'select.pipeline' : 'select.fallback.chain',
    reason: pool.length ? 'hard eligible candidate pool' : 'complete hard candidate pool empty',
    step: 'candidates',
    note: `${slot.id}:${pool.length}`,
  });
  return pool.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}
it('invalidates profile, equipment, excluded list and gate mutation while applying session reuse immediately', () => {
  const ctx = createContext(structuredClone(typicalProfiles[0]));
  function compare() {
    ctx.trace = [];
    const before = uncached(ctx).map(e => e.id),
      trace = structuredClone(ctx.trace);
    ctx.trace = [];
    expect(candidatesFor(slot, ctx.profile, ctx.gate, ctx).map(e => e.id)).toEqual(before);
    expect(ctx.trace).toEqual(trace);
    return before;
  }
  compare();
  const initial = compare();
  expect(initial.length).toBeGreaterThan(0);
  ctx.profile.equipment.push('dumbbell');
  compare();
  ctx.profile.preferences.excludedExerciseIds.push(initial[0]);
  expect(compare()).not.toContain(initial[0]);
  ctx.profile.constraints.quiet = true;
  compare();
  ctx.gate.restrictions.excludePositions.push('standing');
  compare();
  ctx.gate.restrictions.user.hypertension = 'uncontrolled';
  compare();
  ctx.profile.preferences.excludedExerciseIds = [];
  ctx.gate.restrictions.excludePositions = [];
  const remaining = compare();
  if (remaining.length) {
    ctx.usedIds.add(remaining[0]);
    expect(compare()).not.toContain(remaining[0]);
  }
  ctx.rules = new Rules({ ...ctx.rules.data, exercises: [] });
  expect(compare()).toEqual([]);
});
it('preserves exact candidate order and trace on a small repeated sample and measures cache benefit', () => {
  const contexts = [0, 3, 4, 6].map(index => createContext(structuredClone(typicalProfiles[index])));
  for (const ctx of contexts) {
    ctx.trace = [];
    const expected = uncached(ctx).map(e => e.id),
      trace = structuredClone(ctx.trace);
    ctx.trace = [];
    expect(candidatesFor(slot, ctx.profile, ctx.gate, ctx).map(e => e.id)).toEqual(expected);
    expect(ctx.trace).toEqual(trace);
  }
  const rounds = 24,
    start = performance.now();
  for (let i = 0; i < rounds; i++) for (const ctx of contexts) uncached(ctx);
  const originalMs = performance.now() - start;
  const warm = performance.now();
  for (let i = 0; i < rounds; i++) for (const ctx of contexts) candidatesFor(slot, ctx.profile, ctx.gate, ctx);
  const cachedMs = performance.now() - warm;
  console.log(
    JSON.stringify({
      sampleProfiles: contexts.length,
      repetitions: rounds,
      originalMs,
      cachedMs,
      speedup: originalMs / cachedMs,
    }),
  );
});
