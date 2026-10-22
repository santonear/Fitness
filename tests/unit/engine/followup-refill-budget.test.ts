import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../../src/engine';
import { Rules } from '../../../src/engine/data';
import { estimateSeconds } from '../../../src/engine/fit';
import { baseProfile, sampledProfiles } from '../../../tools/eval/training-engine-profiles';

const rules = new Rules();
describe('balanced refill budget', () => {
  it('registers the approved order and mobility budget in mechanic data', () => {
    expect(rules.get('duration.cardio.cap').refill).toMatchObject({
      order: ['existing_sets', 'missing_patterns', 'low_intensity', 'balance_breathing', 'stretch', 'warmup_cooldown'],
      mobility_budget: { minimum_seconds: 600, session_fraction: 0.25 },
    });
  });
  it.each([0, 1])('retains the original two strength-day limit in introductory week index %i', week => {
    const profile = baseProfile({ trainingAgeWeeks: week, daysPerWeek: 3, sessionMinutes: 30 });
    const plan = generatePlan(profile);
    expect(plan.templates).toHaveLength(3);
    expect(
      plan.templates.filter(t =>
        t.items.some(
          item =>
            ['main', 'accessory'].includes(item.prescription?.block ?? '') &&
            ['strength', 'power', 'isometric'].includes(rules.byExercise.get(item.exerciseId)!.modality),
        ),
      ).length,
    ).toBeLessThanOrEqual(2);
  });
  it('distributes strength across every available day from introductory week three', () => {
    const plan = generatePlan(baseProfile({ trainingAgeWeeks: 2, daysPerWeek: 3, sessionMinutes: 30 }));
    expect(plan.templates).toHaveLength(3);
    for (const template of plan.templates)
      expect(
        template.items.some(
          item =>
            ['main', 'accessory'].includes(item.prescription?.block ?? '') &&
            ['strength', 'power', 'isometric'].includes(rules.byExercise.get(item.exerciseId)!.modality),
        ),
      ).toBe(true);
  });
  it.each(sampledProfiles(80).map((profile, index) => ({ profile, index })))(
    'keeps the mobility cap for fixed profile $index',
    ({ profile, index }) => {
      const violations: string[] = [];
      for (const template of generatePlan(profile).templates) {
        const mobility = template.items.filter(item => {
          const exercise = rules.byExercise.get(item.exerciseId)!;
          return (
            exercise.modality === 'mobility' &&
            exercise.primary_pattern !== 'balance' &&
            !exercise.flags.includes('breathing')
          );
        });
        const actual = estimateSeconds(template, rules),
          stretch = estimateSeconds({ items: mobility }, rules);
        if (stretch > Math.max(600, actual * 0.25))
          violations.push(`${index}/${template.weekday}: ${stretch}/${actual}`);
      }
      expect(violations).toEqual([]);
    },
  );
});
