import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { independentPregnancyIssues } from '../../support/engine/independent-pregnancy';
import { generatePlan, validatePlan } from '../../../src/engine';
import { prescribe } from '../../../src/engine/dose';
import { runGates } from '../../../src/engine/gates';
import { isHardEligible } from '../../../src/engine/candidates';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrescriptionDetails } from '../../../src/ui/pages/training/PrescriptionDetails';
const r = new Rules(),
  tree = r.data.exercises.find(e => e.slug === 'tree-pose')!,
  climber = r.data.exercises.find(e => e.slug === 'mountain-climbers')!;
const profile = (week = 20) =>
  baseProfile({
    population: {
      kind: 'pregnant',
      week,
      prenatalCareConfirmed: true,
      providerCleared: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: week,
    },
    screening: { ...baseProfile().screening, activityStatus: 'active' },
    daysPerWeek: 3,
    sessionMinutes: 60,
    place: 'home',
    equipment: ['none'],
  });
it('excludes the rapid running-like mountain climber for a confirmed 20-week pregnancy', () => {
  const p = profile();
  expect(climber.flags).toContain('running');
  expect(climber.impact).toBe(1);
  expect(isHardEligible(climber, p, runGates(p, r), { rules: r })).toBe(false);
  expect(
    generatePlan(p)
      .templates.flatMap(t => t.items)
      .some(i => i.exerciseId === climber.id),
  ).toBe(false);
});
it.each([13, 20, 27])('prescribes real support and displays the registered cue at week %i', week => {
  const p = profile(week);
  const item = prescribe(tree, p, r, runGates(p, r).restrictions, 'balance', 1);
  expect(item.equipment).toBe('wall');
  expect(item.prescription?.safetyCue?.zh).toBe('扶墙或扶椅');
  expect(
    renderToStaticMarkup(createElement(PrescriptionDetails, { prescription: item.prescription, locale: 'zh' })),
  ).toContain('扶墙或扶椅');
});
it('does not offer the unsupported tree pose when a second-trimester user has no support', () => {
  const p = { ...profile(), place: 'outdoor' as const, householdSupport: false };
  expect(isHardEligible(tree, p, runGates(p, r), { rules: r })).toBe(false);
});
it('keeps the original 28-week exclusion and leaves nonpregnant prescriptions unchanged', () => {
  const p = profile(28);
  expect(isHardEligible(tree, p, runGates(p, r), { rules: r })).toBe(false);
  const normal = baseProfile();
  expect(
    prescribe(tree, normal, r, runGates(normal, r).restrictions, 'balance', 1).prescription?.safetyCue,
  ).toBeUndefined();
});
it.each(['cue', 'equipment'])('independently rejects missing support evidence: %s', missing => {
  const p = profile(),
    plan = generatePlan(p);
  const item = prescribe(tree, p, r, runGates(p, r).restrictions, 'balance', 1);
  const invalid = structuredClone(item);
  if (missing === 'equipment') invalid.equipment = 'none';
  else delete invalid.prescription!.safetyCue;
  const bad = { ...plan, templates: [{ ...plan.templates[0], items: [invalid] }] };
  expect(validatePlan(bad, p).some(issue => issue.code === 'pregnancy_balance_support')).toBe(true);
  expect(independentPregnancyIssues(bad, p, r).some(issue => issue.code === 'independent_pregnancy_support')).toBe(
    true,
  );
});

it('does not require the second-trimester cue before week13', () => {
  const p = profile(12),
    item = prescribe(tree, p, r, runGates(p, r).restrictions, 'balance', 1);
  expect(item.equipment).toBe('none');
  expect(item.prescription?.safetyCue).toBeUndefined();
});
it('uses an explicitly owned chair outdoors instead of assuming a wall', () => {
  const p = {
    ...profile(),
    place: 'outdoor' as const,
    householdSupport: false,
    equipment: ['none', 'chair'] as ReturnType<typeof profile>['equipment'],
  };
  const item = prescribe(tree, p, r, runGates(p, r).restrictions, 'balance', 1);
  expect(isHardEligible(tree, p, runGates(p, r), { rules: r })).toBe(true);
  expect(item.equipment).toBe('chair');
});

it('does not relabel controlled knee tucks or slow crawling as running', () => {
  for (const slug of ['plank-knee-tuck', 'custom-slow-bear-step']) {
    const e = r.data.exercises.find(e => e.slug === slug)!;
    expect(e.flags).not.toContain('running');
    expect(e.impact).toBe(0);
  }
  expect(r.data.exercises.find(e => e.slug === 'burpees')!.flags).toContain('jumping');
});

it('retains an independently proven no-support pregnancy draft and restores balance when support is provided', () => {
  const p = { ...profile(), householdSupport: false };
  const plan = generatePlan(p);
  expect(plan.templates.length).toBeGreaterThan(0);
  expect(plan.quality?.status).toBe('environmentLimited');
  expect(plan.quality?.environmentConstraints).toContainEqual({
    ruleId: 'pregnancy.exclude.fall_risk',
    patterns: ['balance'],
    issueCodes: ['pregnancy_balance_environment'],
  });
  expect(plan.notices.some(n => n.message.zh.includes('平衡练习需要'))).toBe(true);
  expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
  const restored = generatePlan({ ...p, householdSupport: true });
  expect(restored.quality?.status).not.toBe('environmentLimited');
  const balance = restored.templates
    .flatMap(t => t.items)
    .filter(i => r.byExercise.get(i.exerciseId)?.primary_pattern === 'balance');
  expect(balance.length).toBeGreaterThan(0);
  for (const item of balance) {
    expect(item.prescription?.safetyCue?.zh).toBe('扶墙或扶椅');
    expect(['wall', 'chair', 'counter']).toContain(item.equipment);
  }
});
it.each(['wall', 'chair'])('keeps at least two real supported balance candidates, each with the cue: %s', support => {
  const p = {
      ...profile(),
      householdSupport: false,
      equipment: ['none', support] as ReturnType<typeof profile>['equipment'],
    },
    gate = runGates(p, r);
  const eligible = r.data.exercises.filter(
    e =>
      e.primary_pattern === 'balance' &&
      e.modality !== 'mobility' &&
      e.difficulty <= 3 &&
      isHardEligible(e, p, gate, { rules: r }),
  );
  expect(eligible.length).toBeGreaterThanOrEqual(2);
  for (const e of eligible) {
    const item = prescribe(e, p, r, gate.restrictions, 'balance', 1);
    expect(item.equipment).toBe(support);
    expect(item.prescription?.safetyCue?.zh).toBe('扶墙或扶椅');
  }
});

it('independently proves the environment claim and refuses it when support is actually available', async () => {
  const { independentBalanceEnvironmentConstraint } = await import('../../../tools/eval/training-engine-quality');
  expect(independentBalanceEnvironmentConstraint({ ...profile(), householdSupport: false }, r)).toMatchObject({
    ruleId: 'pregnancy.exclude.fall_risk',
    patterns: ['balance'],
  });
  expect(independentBalanceEnvironmentConstraint({ ...profile(), householdSupport: true }, r)).toBeUndefined();
});

it('fits supported balance restoration within short-course and inactive-pregnancy caps', async () => {
  const { default: rows } = await import('../../fixtures/training-engine/review62-time-regressions.json');
  const { engineProfileSchema } = await import('../../../src/engine/contracts');
  for (const row of rows) {
    const p = engineProfileSchema.parse(row.profile);
    const plan = generatePlan(p);
    expect(plan.templates.length).toBe(p.daysPerWeek);
    expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
  }
});
