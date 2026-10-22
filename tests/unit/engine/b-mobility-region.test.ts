import { it, expect } from 'vitest';
import { Rules, type Exercise } from '../../../src/engine/data';
import { createContext, generatePlan } from '../../../src/engine/pipeline';
import { buildSlots } from '../../../src/engine/skeleton';
import { candidatesFor } from '../../../src/engine/candidates';
import type { Slot } from '../../../src/engine/contracts';
import { goldenProfiles } from '../../../tools/eval/training-engine-profiles';
import { fixtureProfile } from './fixtures';
type Region = 'lower_body' | 'upper_body' | 'trunk';
type RegionSlot = Slot & { region: Region };
const rules = new Rules(),
  profile = {
    ...structuredClone(fixtureProfile),
    goal: 'mobility' as const,
    level: 'intermediate' as const,
    sessionMinutes: 90,
    equipment: ['none', 'flat-bench'] as typeof fixtureProfile.equipment,
  },
  day = {
    id: 'region-day',
    index: 0,
    kind: 'mobility' as const,
    minutes: 90,
    balanceRequired: false,
    sourceDayRuleId: 'week.day.mobility',
  };
// Independent source interpretation, matching the existing template-target reference.
function matchesRegion(e: Exercise, region: Region) {
  if (e.modality !== 'mobility') return false;
  return region === 'trunk'
    ? e.mobility_type === 'dynamic' &&
        (e.primaryMuscles ?? []).some(m =>
          ['core', 'lower_back'].includes(rules.get('dose.muscle_groups').catalog_map[m]),
        )
    : e.mobility_type === 'static' &&
        (e.stretch_targets ?? []).some(g =>
          (region === 'lower_body' ? ['quads', 'glutes', 'hamstrings'] : ['chest', 'back', 'shoulders']).includes(g),
        );
}
function slot(region: Region): RegionSlot {
  return {
    id: 'region-' + region,
    role: 'mobility',
    patterns: ['mobility'],
    priority: 1,
    optional: false,
    sourceRuleId: 'week.day.mobility',
    region,
  };
}
it('retains every authored formal region on its own source slot', () => {
  const source = rules.get('week.day.mobility').slots.filter((s: { target?: string }) => s.target),
    slots = buildSlots(day, profile, 90, rules);
  for (const expected of source) {
    const actual = slots.find(s => s.id === day.id + '-' + expected.pos) as RegionSlot;
    expect(actual).toBeDefined();
    expect(actual.region).toBe(expected.target);
    expect(actual.role).toBe('mobility');
  }
});
it.each(['lower_body', 'upper_body', 'trunk'] as const)(
  'selects verified %s candidates and never unknown movement metadata',
  region => {
    const ctx = createContext(structuredClone(profile));
    const pool = candidatesFor(slot(region), ctx.profile, ctx.gate, ctx);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(e => matchesRegion(e, region))).toBe(true);
    expect(pool.some(e => e.slug === 'bench-calf-stretch')).toBe(false);
    // Exhausting valid region candidates must not trigger a cross-region or unknown-data fallback.
    ctx.profile.preferences.excludedExerciseIds = ctx.rules.data.exercises
      .filter(e => matchesRegion(e, region))
      .map(e => e.id);
    expect(candidatesFor(slot(region), ctx.profile, ctx.gate, ctx)).toEqual([]);
  },
);
it('retains a genuine region shortfall when only an unknown pose is available', () => {
  const unknown = rules.data.exercises.find(e => e.slug === 'bench-calf-stretch')!;
  expect(unknown.mobility_type).toBeUndefined();
  const ctx = createContext(structuredClone(profile), 0, new Rules({ ...rules.data, exercises: [unknown] }));
  expect(candidatesFor(slot('lower_body'), ctx.profile, ctx.gate, ctx)).toEqual([]);
});
it('does not relax real equipment or session reuse restrictions for a region', () => {
  const source = rules.data.exercises.find(
    e =>
      matchesRegion(e, 'lower_body') && e.equipment_required.some(req => !['none', 'yoga-mat-optional'].includes(req)),
  )!;
  expect(source).toBeDefined();
  const p = {
      ...structuredClone(profile),
      place: 'outdoor' as const,
      householdSupport: false,
      equipment: ['none'] as typeof profile.equipment,
    },
    limited = new Rules({ ...rules.data, exercises: [source] }),
    ctx = createContext(p, 0, limited);
  expect(candidatesFor(slot('lower_body'), p, ctx.gate, ctx)).toEqual([]);
  const available = createContext({ ...p, equipment: source.equipment_required as typeof p.equipment }, 0, limited);
  expect(candidatesFor(slot('lower_body'), available.profile, available.gate, available)).toHaveLength(1);
  available.usedIds.add(source.id);
  expect(candidatesFor(slot('lower_body'), available.profile, available.gate, available)).toEqual([]);
});

it('keeps all three verified source regions in the generated mobility6x90 formal session', () => {
  const fixture = goldenProfiles.find(f => f.id === 'mobility6x90')!,
    plan = generatePlan(fixture.profile),
    source = rules.get('week.day.mobility').slots.filter((s: { target?: Region }) => s.target),
    formal = plan.templates.filter(t => t.items.some(i => i.prescription?.sourcePosition?.endsWith('-mob_1')));
  expect(formal.length).toBeGreaterThan(0);
  for (const t of formal)
    for (const expected of source) {
      const item = t.items.find(i => i.prescription?.sourcePosition?.endsWith('-' + expected.pos));
      expect(item, `${t.id}:${expected.pos}`).toBeDefined();
      expect(matchesRegion(rules.byExercise.get(item!.exerciseId)!, expected.target)).toBe(true);
    }
});
