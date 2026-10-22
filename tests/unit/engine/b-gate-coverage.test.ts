import { describe, it, expect } from 'vitest';
import { runGates } from '../../../src/engine/gates';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
const r = new Rules();
const pregnant = () =>
  baseProfile({
    population: {
      kind: 'pregnant',
      week: 12,
      providerCleared: true,
      prenatalCareConfirmed: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: 12,
    },
  });
const has = (p: ReturnType<typeof baseProfile>, id: string, status = 'blocked') =>
  runGates(p, r).reasons.some(g => g.ruleId === id && g.status === status);
describe('independent source gate input coverage', () => {
  it('safety.scope.age_min rejects 17 and accepts 18', () => {
    const p = baseProfile();
    p.birthYearMonth = '2008-11';
    expect(has(p, 'safety.scope.age_min')).toBe(true);
    p.birthYearMonth = '2008-10';
    expect(has(p, 'safety.scope.age_min', 'pass')).toBe(true);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])('safety.screen.parq explicit positive item %i requires clearance', index => {
    const p = baseProfile();
    p.screening.parqAnswers![index] = true;
    p.screening.parqAllNo = false;
    expect(runGates(p, r).restrictions.user.clearance_state).not.toBe('none_needed');
    p.screening.parqAnswers![index] = false;
    p.screening.parqAllNo = true;
    expect(runGates(p, r).restrictions.user.clearance_state).toBe('none_needed');
  });
  it('safety.screen.parq rejects missing seven-answer completion', () => {
    const p = baseProfile();
    delete p.screening.parqAnswers;
    expect(has(p, 'safety.screen.parq')).toBe(true);
  });
  it('safety.rescreen.interval expires at twelve calendar months and explicit new-diagnosis rescreen flag', () => {
    const p = baseProfile();
    p.screening.completedAt = '2025-10-15T00:00:00Z';
    p.asOfDate = '2026-10-14';
    expect(has(p, 'safety.rescreen.interval')).toBe(false);
    p.asOfDate = '2026-10-15';
    expect(has(p, 'safety.rescreen.interval')).toBe(true);
    p.screening.completedAt = '2026-10-01T00:00:00Z';
    p.screening.rescreenRequired = true;
    expect(has(p, 'safety.rescreen.interval')).toBe(true);
  });
  it('safety.screen.temporary_illness blocks acute illness only when reported', () => {
    const p = baseProfile();
    expect(has(p, 'safety.screen.temporary_illness')).toBe(false);
    p.screening.acuteIllness = true;
    expect(has(p, 'safety.screen.temporary_illness')).toBe(true);
  });
  it.each(['unknown', 'ge_160_90'] as const)('safety.clearance.restricted_mode caps blood pressure %s', restingBp => {
    const p = baseProfile();
    p.screening.restingBp = restingBp;
    expect(has(p, 'safety.clearance.restricted_mode', 'restricted')).toBe(true);
    expect(runGates(p, r).restrictions.maxIntensity).toBeLessThanOrEqual(
      r.get('safety.clearance.restricted_mode').max_rpe_0_10,
    );
  });
  it('safety.clearance.confirm rejects stale, future and pre-screen clearance dates', () => {
    for (const date of ['2025-10-15', '2026-10-16', '2026-09-30']) {
      const p = baseProfile();
      p.screening.restingBp = 'unknown';
      p.screening.clearance = { date, intensity: 'vigorous' };
      expect(has(p, 'safety.clearance.confirm', 'pass'), date).toBe(false);
    }
    const p = baseProfile();
    p.screening.restingBp = 'unknown';
    p.screening.clearance = { date: '2026-10-01', intensity: 'vigorous' };
    expect(has(p, 'safety.clearance.confirm', 'pass')).toBe(true);
  });
  it.each(['light_moderate', 'moderate', 'vigorous'] as const)(
    'safety.clearance.confirm respects permitted %s intensity',
    intensity => {
      const p = baseProfile();
      p.screening.clearance = { date: '2026-10-01', intensity };
      const expected =
        intensity === 'vigorous'
          ? r.get('aerobic.intensity.rpe_scale').vigorous[1]
          : intensity === 'moderate'
            ? r.get('aerobic.intensity.rpe_scale').moderate[1]
            : r.get('safety.clearance.restricted_mode').max_rpe_0_10;
      expect(runGates(p, r).restrictions.maxIntensity).toBeLessThanOrEqual(expected);
    },
  );
  it.each([13, 28])('pregnancy.reconfirm requires renewed answers at week %i', week => {
    const p = pregnant();
    if (p.population.kind !== 'pregnant') throw Error();
    p.population.week = week;
    p.population.lastScreenedWeek = week - 1;
    expect(has(p, 'pregnancy.reconfirm')).toBe(true);
    p.population.lastScreenedWeek = week;
    expect(has(p, 'pregnancy.reconfirm')).toBe(false);
  });
  it('pregnancy provider, absolute and relative gates each block actual input', () => {
    const p = pregnant();
    if (p.population.kind !== 'pregnant') throw Error();
    expect(runGates(p, r).status).not.toBe('blocked');
    p.population.providerCleared = false;
    expect(has(p, 'pregnancy.gate.provider')).toBe(true);
    p.population.providerCleared = true;
    p.population.contraindicationsConfirmedNone = false;
    expect(has(p, 'pregnancy.gate.absolute')).toBe(true);
    p.population.contraindicationsConfirmedNone = true;
    p.population.absoluteContraindications = ['source-positive'];
    expect(has(p, 'pregnancy.gate.absolute')).toBe(true);
    p.population.absoluteContraindications = [];
    p.population.relativeContraindications = ['source-positive'];
    expect(has(p, 'pregnancy.gate.relative')).toBe(true);
  });
  it('older.screen.falls requires all four explicit answers', () => {
    const p = baseProfile({
      birthYearMonth: '1956-01',
      population: { kind: 'older_adult' },
    });
    expect(has(p, 'older.screen.falls')).toBe(true);
    p.population = { kind: 'older_adult', fallsAnswers: [false, false, false] };
    expect(has(p, 'older.screen.falls')).toBe(true);
    p.population = {
      kind: 'older_adult',
      fallsAnswers: [false, false, false, false],
    };
    expect(has(p, 'older.screen.falls')).toBe(false);
  });
});
it('safety.clearance.confirm expires exactly at twelve months independent of old screening', () => {
  const p = baseProfile();
  p.screening.completedAt = '2025-10-15T00:00:00Z';
  p.screening.clearance = { date: '2025-10-15', intensity: 'vigorous' };
  p.asOfDate = '2026-10-14';
  expect(has(p, 'safety.clearance.confirm', 'pass')).toBe(true);
  p.asOfDate = '2026-10-15';
  expect(has(p, 'safety.clearance.confirm', 'pass')).toBe(false);
});
it('retains real older fall pause and supine symptom position exclusion across population edits', () => {
  const p = baseProfile();
  p.olderSafety = { fallPaused: true, balanceStage: 1 };
  expect(runGates(p, r).status).toBe('blocked');
  delete p.olderSafety;
  p.pregnancySafety = { avoidSupine: true };
  expect(runGates(p, r).restrictions.excludePositions).toContain('supine');
});
