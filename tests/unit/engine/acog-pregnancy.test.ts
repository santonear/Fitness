import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { generatePlan, validatePlan } from '../../../src/engine';
import { runGates } from '../../../src/engine/gates';
import { checkHard } from '../../../src/engine/hard-checks';
import { createContext } from '../../../src/engine/pipeline';
import { Rules } from '../../../src/engine/data';
import { prescribe } from '../../../src/engine/dose';
import { buildNotices } from '../../../src/engine/notices';
import { estimatedSeconds } from '../../../src/engine/fit/elapsed-time';
import { independentPregnancyIssues } from '../../support/engine/independent-pregnancy';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { toEngineProfile } from '../../../src/application/engine-profile';
import {
  createPregnancyReconfirmationDraft,
  updatePregnancyReconfirmationDraft,
} from '../../../src/application/pregnancy-safety';
import type { EngineProfile, ScoreResult } from '../../../src/engine/contracts';

const r = new Rules();
function pregnant(weeks = 0, requested = 30, inactive = true): EngineProfile {
  const p = baseProfile({
    trainingAgeWeeks: weeks,
    sessionMinutes: requested,
    population: {
      kind: 'pregnant',
      week: 20,
      providerCleared: true,
      prenatalCareConfirmed: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: 20,
    },
  });
  p.screening.activityStatus = inactive ? 'inactive' : 'active';
  return p;
}

describe('ACOG reviewed pregnancy wiring', () => {
  it.each([false, undefined])('blocks new generation with prenatal answer %s without inventing an answer', answer => {
    const p = pregnant();
    if (p.population.kind !== 'pregnant') throw Error('fixture');
    p.population.prenatalCareConfirmed = answer;
    const plan = generatePlan(p);
    expect(plan.templates).toEqual([]);
    expect(plan.gates).toContainEqual(
      expect.objectContaining({
        ruleId: 'pregnancy.gate.provider',
        status: 'blocked',
        reason: 'prenatal_care_confirmation_missing',
      }),
    );
    expect(plan.notices.some(n => n.message.zh === r.text('pregnancy.gate.copy.ask_provider').zh)).toBe(true);
  });

  it('only exempts the missing new answer for an already-applied plan; all other gates remain', () => {
    const p = pregnant();
    if (p.population.kind !== 'pregnant') throw Error('fixture');
    delete p.population.prenatalCareConfirmed;
    expect(runGates(p, r).status).toBe('blocked');
    expect(runGates(p, r, { allowLegacyPrenatalCare: true }).status).not.toBe('blocked');
    expect(p.population.prenatalCareConfirmed).toBeUndefined();
    p.population.week = 28;
    expect(runGates(p, r, { allowLegacyPrenatalCare: true }).status).toBe('blocked');
    p.population.lastScreenedWeek = 28;
    p.population.prenatalCareConfirmed = false;
    expect(runGates(p, r, { allowLegacyPrenatalCare: true }).status).toBe('blocked');
  });

  it('retains all other hard checks on an inactive legacy course instead of forgiving intensity errors', () => {
    const p = pregnant(4, 30);
    p.level = 'intermediate';
    const applied = generatePlan(p);
    const legacy = {
      ...p,
      trainingAgeWeeks: 0,
      population: { ...p.population },
    };
    if (legacy.population.kind !== 'pregnant') throw Error('fixture');
    delete legacy.population.prenatalCareConfirmed;
    const gate = runGates(legacy, r, { allowLegacyPrenatalCare: true });
    const issues = checkHard(applied, legacy, gate, r);
    expect(issues.some(i => i.code === 'pregnancy_inactive_ramp')).toBe(true);
    expect(issues.filter(i => i.severity === 'error' && i.code !== 'pregnancy_inactive_ramp')).toEqual([]);
    const unsafe = structuredClone(applied);
    unsafe.templates[0].items[0].prescription!.targetRpe = [10, 10];
    expect(checkHard(unsafe, legacy, gate, r).some(i => i.code === 'intensity_cap')).toBe(true);
  });

  it.each([13, 28])('requires a fresh prenatal answer at week %s', week => {
    const p = pregnant();
    if (p.population.kind !== 'pregnant') throw Error('fixture');
    p.population.week = week - 1;
    p.population.lastScreenedWeek = week - 1;
    const draft = updatePregnancyReconfirmationDraft(createPregnancyReconfirmationDraft(p.population), {
      type: 'week',
      week,
    });
    expect(draft.prenatalCareConfirmed).toBeUndefined();
    expect(draft.provider).toBeUndefined();
  });

  it('answering the new question alone does not re-date a legacy completed screening', () => {
    const p = pregnant();
    if (p.population.kind !== 'pregnant') throw Error('fixture');
    delete p.population.prenatalCareConfirmed;
    const draft = updatePregnancyReconfirmationDraft(createPregnancyReconfirmationDraft(p.population), {
      type: 'prenatal',
      answer: true,
    });
    expect(draft.prenatalCareConfirmed).toBe(true);
    expect(draft.provider).toBe(true);
    expect(draft.lastScreenedWeek).toBe(20);
    expect(draft.cycle).toBe('none');
  });

  it.each([
    [0, 30, 10],
    [4, 30, 30],
    [4, 10, 10],
  ])('week index %s, available %s minutes respects a %s-minute cap', (weeks, requested, cap) => {
    const p = pregnant(weeks, requested),
      plan = generatePlan(p);
    expect(plan.templates).toHaveLength(p.daysPerWeek);
    for (const t of plan.templates) {
      expect(t.items.length).toBeGreaterThan(0);
      expect(t.targetMinutes).toBe(cap);
      expect(estimatedSeconds(t, r)).toBeLessThanOrEqual(Math.min(10 + weeks * 5, 30, requested * 1.2) * 60);
    }
    expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
    expect(independentPregnancyIssues(plan, p, r)).toEqual([]);
    if (cap < requested) {
      expect(plan.trace.some(t => t.reason === 'pregnancy_inactive_ramp')).toBe(true);
      expect(plan.notices.some(n => n.code === 'session.copy.intentional_short')).toBe(true);
    }
  });

  it('rejects a forged elapsed/target declaration independently', () => {
    const p = pregnant(),
      plan = generatePlan(p),
      t = plan.templates[0];
    t.targetMinutes = 30;
    expect(validatePlan(plan, p)).toContainEqual(
      expect.objectContaining({
        code: 'pregnancy_inactive_ramp',
        severity: 'error',
      }),
    );
    expect(independentPregnancyIssues(plan, p, r)).toContainEqual(
      expect.objectContaining({ code: 'independent_pregnancy_ramp' }),
    );
  });

  it('does not use the exact adoption time to randomize equal ramp-week profiles', () => {
    const p = pregnant(4, 30),
      other = structuredClone(p);
    if (p.population.kind !== 'pregnant' || other.population.kind !== 'pregnant') throw Error('fixture');
    p.population.inactiveRampStartedAt = '2026-09-01T01:00:00.000Z';
    other.population.inactiveRampStartedAt = '2026-09-01T03:00:00.000Z';
    expect(generatePlan(p)).toEqual(generatePlan(other));
  });

  it('uses the pregnancy ramp start, not old pre-pregnancy training history, at weeks one and five', () => {
    const p = pregnant(),
      at = '2026-10-01T00:00:00.000Z';
    const local = {
      goalText: '活动',
      weeklyTarget: 3,
      sessionMinutes: 30,
      scheduleOriginalText: '每次30分钟',
      place: 'home' as const,
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
      confirmedAt: at,
      healthStorageConsent: { acceptedAt: at },
      population: p.population,
      screening: p.screening,
    };
    const first = toEngineProfile(local, {
      asOfDate: '2026-10-01',
      timeZone: 'UTC',
    });
    expect(first?.trainingAgeWeeks).toBe(0);
    if (local.population.kind !== 'pregnant') throw Error('fixture');
    local.population.inactiveRampStartedAt = at;
    expect(toEngineProfile(local, { asOfDate: '2026-10-29', timeZone: 'UTC' })?.trainingAgeWeeks).toBe(4);
  });

  it('limits only explicitly tagged static-standing holds, not walking or seated duration work', () => {
    const p = pregnant(8, 60, false),
      gate = runGates(p, r),
      plan = generatePlan(p);
    const standing = r.data.exercises.find(e => e.slug === 'custom-supported-wide-static-stand')!;
    const walking = r.data.exercises.find(e => e.slug === 'walking')!;
    expect(standing.flags).toContain('static_standing_hold');
    expect(walking.flags).not.toContain('static_standing_hold');
    const item = prescribe(standing, p, r, gate.restrictions);
    expect('durationSeconds' in item.target && item.target.durationSeconds).toBeLessThanOrEqual(60);
    item.target = { metricType: 'duration', durationSeconds: 61 };
    plan.templates[0].items = [item];
    expect(validatePlan(plan, p)).toContainEqual(expect.objectContaining({ code: 'pregnancy_static_standing' }));
    expect(independentPregnancyIssues(plan, p, r)).toContainEqual(
      expect.objectContaining({ code: 'independent_pregnancy_standing' }),
    );
  });

  it.each([2700, 2701])(
    'uses actual seconds %s for the 45-minute notice, below stop/environment and above quality',
    seconds => {
      const p = pregnant(8, 60, false),
        ctx = createContext(p, 0, r),
        plan = generatePlan(p);
      const walking = r.data.exercises.find(e => e.slug === 'walking')!;
      const item = prescribe(walking, p, r, ctx.gate.restrictions, 'conditioning', 1);
      item.sets = 1;
      item.target = { metricType: 'duration', durationSeconds: seconds };
      const t = { ...plan.templates[0], items: [item] };
      const overhead = estimatedSeconds(t, r) - seconds;
      item.target.durationSeconds -= overhead;
      expect(estimatedSeconds(t, r)).toBe(seconds);
      ctx.plan = { ...plan, templates: [t] };
      const gate = { ...ctx.gate, notices: [...ctx.gate.notices] };
      r.notice(gate.notices, 'engine.copy.environment_balance', 'warning');
      const score = {
        perRule: [{ id: 'session.cooldown.stretch', satisfaction: 0, weight: 100 }],
        advice: [],
      } as unknown as ScoreResult;
      const notices = buildNotices(score, gate, ctx);
      expect(notices.length).toBeLessThanOrEqual(3);
      expect(notices.some(n => n.code === 'pregnancy.copy.long_session.copy')).toBe(seconds > 2700);
      if (seconds > 2700)
        expect(notices.map(n => n.code)).toEqual([
          'pregnancy.stop.copy.stop',
          'engine.copy.environment_balance',
          'pregnancy.copy.long_session.copy',
        ]);
    },
  );

  it('registers hydration, heat, altitude and correct source attribution without old verification markers', () => {
    expect(r.text('postpartum.breastfeeding.tip').zh).toContain('运动前也记得喝水。');
    expect(r.text('pregnancy.environment.copy.heat').en).toContain('wear loose, breathable clothing');
    expect(r.text('pregnancy.environment.copy.altitude').zh).toContain('1,800');
    expect(r.byId.get('pregnancy.inactive.ramp')?.severity).toBe('hard');
    expect(r.byId.get('pregnancy.copy.long_session')?.severity).toBe('copy');
    expect(JSON.stringify(r.get('pregnancy.gate.copy'))).not.toMatch(/待核实|to verify/);
    const authored = parse(
      readFileSync(new URL('../../../data/training-engine/rules/rules-ch11.yaml', import.meta.url), 'utf8'),
    );
    expect(authored.find((row: { id: string }) => row.id === 'pregnancy.gate.relative').sources).toContain(
      'E05:ACOG650',
    );
  });
});
