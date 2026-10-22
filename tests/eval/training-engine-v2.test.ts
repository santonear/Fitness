import { describe, it, expect } from 'vitest';
import { engineProfileSchema } from '../../src/engine/contracts';
import type { EnginePlan } from '../../src/engine/contracts';
import { generatePlan, validatePlan } from '../../src/engine';
import {
  independentEquipment,
  independentlyPossibleIds,
  independentlyCurrentClearance,
} from '../../tools/eval/training-engine-quality';
import { externalIssues } from '../../tools/eval/training-engine-invariants';
import { targetRuleIds, scorePlan } from '../../src/engine/score';
import { Rules } from '../../src/engine/data';
import { baseProfile, sampledProfiles, extremeProfiles } from '../../tools/eval/training-engine-profiles';
import {
  classifyPlan,
  percentile,
  qualityMetrics,
  measuredScore,
  environmentStatistics,
} from '../../tools/eval/training-engine-audit';
const empty = (): EnginePlan => ({
  weeklyTarget: 3,
  sessionMinutes: 30,
  templates: [],
  meta: { engineVersion: 'test', rulesVersion: 'test', seed: 'test' },
  trace: [],
  notices: [],
  gates: [],
});
describe('V2 evaluator evidence boundaries', () => {
  it('pins exact weighted quotas, independent extremes, valid profiles and repeatability', () => {
    const rows = sampledProfiles();
    const counts: Record<string, number> = {};
    for (const p of rows) {
      engineProfileSchema.parse(p);
      counts[p.population.kind] = (counts[p.population.kind] ?? 0) + 1;
    }
    expect(counts).toEqual({
      general: 1400,
      older_adult: 300,
      pregnant: 160,
      postpartum: 140,
    });
    expect(sampledProfiles(80)).toEqual(rows.slice(0, 80));
    expect(extremeProfiles()).toHaveLength(200);
    for (const p of extremeProfiles()) engineProfileSchema.parse(p);
    expect(extremeProfiles(10)).toEqual(extremeProfiles(10));
    expect(rows.filter(p => p.sessionMinutes >= 20 && p.sessionMinutes <= 45).length).toBe(1600);
  });
  it('fails ordinary empty plans and forged environment claims', () => {
    const p = baseProfile(),
      plan = empty();
    expect(classifyPlan(plan, p, []).status).toBe('fail');
    plan.quality = {
      status: 'unavailable',
      issues: [],
      basis: 'no_safe_candidates',
    };
    expect(classifyPlan(plan, p, []).status).toBe('fail');
  });
  it('does not confuse genuine candidate vacuum with health blocking or quality success', () => {
    const p = baseProfile({
        preferences: { excludedExerciseIds: [], cannotDo: [] },
      }),
      plan = empty();
    // Exclude the entire source catalogue explicitly: no safe fallback may bypass this user choice.
    p.preferences.excludedExerciseIds = new Rules().data.exercises.map(e => e.id);
    plan.quality = {
      status: 'unavailable',
      issues: [],
      basis: 'no_safe_candidates',
    };
    expect(classifyPlan(plan, p, []).status).toBe('fail');
    expect(
      classifyPlan(plan, p, [
        {
          code: 'unsafe',
          ruleId: 'select.pipeline',
          severity: 'error',
          reason: 'unsafe',
        },
      ]).status,
    ).toBe('fail');
    expect(qualityMetrics(plan, p).coverage).toBe(false);
    expect(qualityMetrics(plan, p).within10).toBe(false);
  });
  it('independently verifies required balance vacuum, preserving raw hard errors and a safe draft', () => {
    const p = baseProfile({
      place: 'outdoor',
      householdSupport: false,
      population: {
        kind: 'older_adult',
        balanceCautious: true,
        fallsAnswers: [false, false, false, false],
      },
      birthYearMonth: '1956-06',
    });
    const plan = generatePlan(p),
      issues = [...validatePlan(plan, p), ...externalIssues(plan, p)];
    expect(plan.templates.every(t => t.items.length > 0)).toBe(true);
    expect(
      issues.some(
        i =>
          i.code === new Rules().get('older.template.balance_required').environment_exception.warning_code &&
          i.severity === 'warning',
      ),
    ).toBe(true);
    expect(classifyPlan(plan, p, issues)).toMatchObject({
      status: 'environment_limited',
      blocked: false,
      environmentConstraints: [
        {
          ruleId: 'older.template.balance_required',
          patterns: ['balance'],
          issueCodes: ['balance_days'],
        },
      ],
    });
    expect(
      plan.quality?.issues.some(
        i =>
          i.code === new Rules().get('older.template.balance_required').environment_exception.warning_code &&
          i.severity === 'warning',
      ),
    ).toBe(true);
    expect(
      classifyPlan(plan, p, [
        ...issues,
        {
          code: 'duration_tolerance',
          ruleId: 'duration.fit.bounds',
          severity: 'error',
          reason: 'unsafe duration',
        },
      ]).status,
    ).toBe('fail');
    const extra = structuredClone(plan);
    extra.quality!.issues.push({
      code: 'invalid_sets',
      ruleId: 'dose.sets_session.cap',
      severity: 'error',
      reason: 'hidden unsafe dose',
    });
    expect(classifyPlan(extra, p, issues).status).toBe('fail');
    const forged = structuredClone(plan);
    forged.quality!.environmentConstraints![0].patterns = ['push_horizontal'];
    expect(classifyPlan(forged, p, issues).status).toBe('fail');
    expect(classifyPlan(plan, { ...p, daysPerWeek: 2 }, issues).status).toBe('fail');
    expect(classifyPlan(plan, baseProfile(), issues).status).toBe('fail');
    const pool = baseProfile({
      ...p,
      equipment: ['none', 'chair', 'wall'],
      preferences: { excludedExerciseIds: [], cannotDo: [] },
    });
    expect(classifyPlan(plan, pool, issues).status).toBe('fail');
    const health = baseProfile({
      ...p,
      painState: [{ pattern: 'balance', remainingSessions: 3 }],
    });
    expect(classifyPlan(plan, health, issues).status).toBe('fail');
    const excluded = baseProfile({
      ...p,
      preferences: {
        excludedExerciseIds: new Rules().data.exercises.filter(e => e.primary_pattern === 'balance').map(e => e.id),
        cannotDo: [],
      },
    });
    expect(classifyPlan(plan, excluded, issues).status).toBe('fail');
    const blank = structuredClone(plan);
    blank.templates = [];
    expect(classifyPlan(blank, p, issues).status).toBe('fail');
  });
  it('independently defaults support by place, without coupling it to mat-sized space', () => {
    const r = new Rules(),
      home = baseProfile({
        population: {
          kind: 'older_adult',
          balanceCautious: true,
          fallsAnswers: [false, false, false, false],
        },
        birthYearMonth: '1956-06',
        constraints: { noJump: false, quiet: false, space: 'mat' },
      });
    expect([...independentEquipment(home)]).toEqual(expect.arrayContaining(['wall', 'chair', 'counter']));
    expect(independentEquipment({ ...home, place: 'outdoor' }).has('chair')).toBe(false);
    expect(independentEquipment({ ...home, householdSupport: false }).has('chair')).toBe(false);
    expect(independentlyPossibleIds(home).some(id => r.byExercise.get(id)?.primary_pattern === 'balance')).toBe(true);
    const plan = generatePlan(home),
      issues = [...validatePlan(plan, home), ...externalIssues(plan, home)];
    expect(classifyPlan(plan, home, issues).status).toBe('pass');
    expect(issues).toEqual([]);
  });
  it('keeps clearance dates and health unchanged while proving an environmental recovery', () => {
    const r = new Rules(),
      p = baseProfile();
    p.screening.clearance = { date: '2026-10-10', intensity: 'moderate' };
    expect(independentlyCurrentClearance(p, r)).toBe(true);
    expect(independentlyCurrentClearance({ ...p, asOfDate: '2030-10-15' }, r)).toBe(false);
    p.screening.clearance.date = '2026-09-01';
    expect(independentlyCurrentClearance(p, r)).toBe(false);
    p.screening.clearance.date = '2026-10-20';
    expect(independentlyCurrentClearance(p, r)).toBe(false);
  });
  it('requires a real hard rule and explanatory copy for health blocking', () => {
    const plan = empty();
    plan.gates = [{ status: 'blocked', ruleId: 'invented.rule', reason: 'blocked' }];
    expect(classifyPlan(plan, baseProfile(), []).status).toBe('fail');
  });
  it('scores applicable rows without inventing perfect values for absent history or populations', () => {
    const id = targetRuleIds[0],
      score = {
        quality: 0.25,
        perRule: [{ id, weight: 2, satisfaction: 0.25 }],
        advice: [],
      };
    expect(measuredScore(score)).toBe(0.25);
    expect(measuredScore({ ...score, perRule: [] })).toBeNull();
    const plan = empty(),
      actual = scorePlan(plan, baseProfile());
    expect(actual.perRule.length).toBeLessThan(38);
    expect(qualityMetrics(plan, baseProfile()).score).toBe(actual.quality);
  });
  it('rejects missing or duplicated registrations, invalid observations and fabricated scores', () => {
    const id = targetRuleIds[0],
      row = { id, weight: 2, satisfaction: 0.25 },
      score = { quality: 0.25, perRule: [row], advice: [] };
    expect(measuredScore(score, targetRuleIds.slice(1))).toBeNull();
    expect(measuredScore(score, [...targetRuleIds.slice(1), targetRuleIds[1]])).toBeNull();
    for (const patch of [
      { weight: 0 },
      { weight: NaN },
      { satisfaction: NaN },
      { satisfaction: 1.1 },
      { id: 'unknown' },
    ])
      expect(measuredScore({ ...score, perRule: [{ ...row, ...patch }] })).toBeNull();
    expect(measuredScore({ ...score, perRule: [row, row] })).toBeNull();
    expect(measuredScore({ ...score, quality: 1 })).toBeNull();
  });
  it('uses the weighted input count for the environment ceiling, excluding independent extremes', () => {
    expect(environmentStatistics(10, 200, 2000)).toMatchObject({
      weightedFraction: 0.005,
      withinWeightedLimit: true,
    });
    expect(environmentStatistics(11, 0, 2000).withinWeightedLimit).toBe(false);
    expect(environmentStatistics(0, 200, 2000).weightedFraction).toBe(0);
    expect(environmentStatistics(0, 0, 0).withinWeightedLimit).toBe(false);
  });
  it('uses nearest-rank percentiles and leaves absent observations unmeasured', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2);
    expect(
      percentile(
        Array.from({ length: 100 }, (_, i) => i + 1),
        0.1,
      ),
    ).toBe(10);
  });
});
