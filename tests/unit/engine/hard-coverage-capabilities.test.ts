import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rules } from '../../../src/engine/data';
import { engineProfileSchema, prescriptionSchema } from '../../../src/engine/contracts';
import { runGates } from '../../../src/engine/gates';
import { isHardEligible } from '../../../src/engine/candidates';
import { prescribe } from '../../../src/engine/dose';
import { PrescriptionDetails } from '../../../src/ui/pages/training/PrescriptionDetails';
import { fixtureProfile } from './fixtures';
const r = new Rules(),
  older = () => ({
    ...structuredClone(fixtureProfile),
    level: 'intermediate' as const,
    trainingAgeWeeks: 30,
    birthYearMonth: '1950-01',
    population: { kind: 'older_adult' as const, fallsAnswers: [false, false, false, false] },
  });
it('older.power.gate has no optional fast-power mode in the public profile or prescription contract', () => {
  const p = older(),
    rule = r.get('older.power.gate');
  expect(rule.unlock_when.all).toHaveLength(3);
  for (const key of [
    'olderPower',
    'powerMode',
    'weeksConsistentTraining',
    'sessionCompletionPctLast6Weeks',
    'flaggedSymptomsLast6Weeks',
  ])
    expect(engineProfileSchema.safeParse({ ...p, [key]: true }).success, key).toBe(false);
  const walking = r.data.exercises.find(e => e.slug === 'walking')!,
    item = prescribe(walking, p, r, runGates(p, r).restrictions, 'conditioning');
  expect(prescriptionSchema.safeParse({ ...item.prescription, olderPower: true }).success).toBe(false);
});
it('ordinary older power is excluded from the complete legal pool, while ordinary legal strength remains available', () => {
  const p = older(),
    g = runGates(p, r),
    power = r.data.exercises.filter(e => e.modality === 'power');
  expect(power.length).toBeGreaterThan(0);
  expect(g.status).not.toBe('blocked');
  for (const e of power) expect(isHardEligible(e, p, g, { rules: r }), e.slug).toBe(false);
  expect(r.data.exercises.some(e => e.modality === 'strength' && isHardEligible(e, p, g, { rules: r }))).toBe(true);
});
it('older aerobic prescription is within source moderate RPE and rejects unsupported heart-rate metadata', () => {
  const p = older(),
    g = runGates(p, r),
    walking = r.data.exercises.find(e => e.slug === 'walking')!,
    item = prescribe(walking, p, r, g.restrictions, 'conditioning');
  expect(isHardEligible(walking, p, g, { rules: r })).toBe(true);
  expect(item.prescription!.targetRpe).toBeDefined();
  expect(item.prescription!.targetRpe![1]).toBeLessThanOrEqual(r.get('older.intensity.aerobic').moderate.rpe_0_10.max);
  for (const key of ['targetHR', 'targetHr', 'heartRate', 'bpm'])
    expect(prescriptionSchema.safeParse({ ...item.prescription, [key]: 120 }).success, key).toBe(false);
  const html = renderToStaticMarkup(
    createElement(PrescriptionDetails, { prescription: item.prescription!, locale: 'en' }),
  );
  expect(html).not.toContain('RIR');
  expect(html).not.toMatch(/targetHR|heart rate|bpm/i);
});
