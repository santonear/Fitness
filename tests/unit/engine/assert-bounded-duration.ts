import { expect } from 'vitest';
import type { EnginePlan, EngineProfile } from '../../../src/engine/contracts';
import { Rules } from '../../../src/engine/data';
import { runGates } from '../../../src/engine/gates';
import { checkHard } from '../../../src/engine/hard-checks';
import { estimateSeconds } from '../../../src/engine/fit';
import { cardioWorkCap, cardioWorkSeconds } from '../../../src/engine/fit/cardio-cap';
import { exhaustedSafeCapacity } from '../../../src/engine/checkHard/cardio-duration';

/** Keep bounded-short warnings explicit and recheck their actual capacity proof. */
export function assertBoundedDuration(plan: EnginePlan, p: EngineProfile, r = new Rules(), requireShort = false) {
  const gate = runGates(p, r),
    issues = checkHard(plan, p, gate, r),
    warnings = issues.filter(issue => issue.code === 'intentional_short');
  expect(issues.filter(issue => issue.code !== 'intentional_short')).toEqual([]);
  if (requireShort) expect(warnings.length).toBeGreaterThan(0);
  for (const t of plan.templates) {
    const target = t.targetMinutes ?? p.sessionMinutes,
      bounds = r.get('duration.fit.bounds'),
      low =
        target === 10
          ? (bounds.min10_duration_seconds?.[0] ?? target * 60 * bounds.duration_band[0])
          : target * 60 * bounds.duration_band[0];
    if (
      t.durationScope !== 'untargeted' &&
      !(gate.restrictions.population === 'postpartum' && gate.restrictions.phase === 1) &&
      estimateSeconds(t, r) < low
    )
      expect(warnings).toContainEqual(
        expect.objectContaining({
          code: 'intentional_short',
          templateId: t.id,
          severity: 'warning',
        }),
      );
    const totals = new Map<string, number>();
    for (const item of t.items) {
      const e = r.byExercise.get(item.exerciseId);
      if (e?.modality !== 'cardio') continue;
      totals.set(e.id, (totals.get(e.id) ?? 0) + cardioWorkSeconds(item, e, r));
    }
    for (const [id, total] of totals)
      expect(total).toBeLessThanOrEqual(cardioWorkCap(r.byExercise.get(id)!, p, r, gate));
  }
  for (const warning of warnings) {
    expect(warning).toMatchObject({
      severity: 'warning',
      ruleId: 'duration.cardio.cap',
      reason: 'actual bounded safe workload cannot fill declared duration',
    });
    const t = plan.templates.find(template => template.id === warning.templateId)!;
    expect(estimateSeconds(t, r)).toBeLessThan(
      (t.targetMinutes ?? p.sessionMinutes) * 60 * r.get('duration.fit.bounds').duration_band[0],
    );
    expect(
      exhaustedSafeCapacity(t, p, gate, r, proposal => {
        const copy = structuredClone(plan);
        copy.templates.find(row => row.id === t.id)!.items = proposal.items;
        return !checkHard(copy, p, gate, r, true).some(issue => issue.severity === 'error');
      }),
    ).toBe(true);
  }
  return warnings;
}
