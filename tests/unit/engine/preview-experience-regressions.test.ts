import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import fixture from '../../fixtures/training-engine/new-caution-adjustment.json';
import { engineProfileSchema, type EnginePrescription } from '../../../src/engine/contracts';
import { engineReplacementIds } from '../../../src/application/engine-replacement-candidates';
import { Rules } from '../../../src/engine/data';
import { equipmentAvailable } from '../../../src/engine/candidates';
import { diffTemplates, unchangedTemplates } from '../../../src/assistant/template-diff';
import { durationText } from '../../../src/ui/components/ExerciseTargets';
import { equipmentLabel } from '../../../src/catalog/taxonomy';
import { PrescriptionDetails } from '../../../src/ui/pages/training/PrescriptionDetails';

const rules = new Rules(),
  profile = engineProfileSchema.parse(fixture.profile);
it('quiet no-jump replacement pool excludes the actual running movements', () => {
  const ids = engineReplacementIds(
    {
      ...profile,
      constraints: { ...profile.constraints, quiet: true, noJump: true },
    },
    rules,
  );
  expect(ids.length).toBeGreaterThan(0);
  for (const slug of ['heel-flicks', 'high-knees']) {
    const e = rules.data.exercises.find(e => e.slug === slug)!;
    expect(e.flags).toContain('running');
    expect(e.impact).toBeGreaterThanOrEqual(2);
    expect(ids).not.toContain(e.id);
  }
  expect(engineReplacementIds(undefined, rules)).toEqual([]);
});
it('an implicit household handhold never certifies a load-bearing workout bench', () => {
  const home = {
    ...profile,
    equipment: ['none' as const],
    place: 'home' as const,
    householdSupport: true,
  };
  for (const slug of ['incline-push-ups', 'bench-figure-4-glute-stretch', 'bench-adductor-stretch', 'box-squat']) {
    const e = rules.data.exercises.find(e => e.slug === slug);
    expect(e, slug).toBeDefined();
    expect(equipmentAvailable(e!, home), slug).toBe(false);
  }
});
it('target durations and all reported support keys have readable labels', () => {
  expect(durationText(1605, 'zh')).toBe('约 27 分钟');
  expect(durationText(60, 'zh')).toBe('60 秒');
  for (const key of ['box or step', 'box-or-step', 'wall', 'chair', 'yoga-mat-optional'])
    expect(equipmentLabel(key, 'zh')).not.toMatch(/[a-z]/);
});
it('source-only metadata does not inflate the visible change list', () => {
  const item = {
    exerciseId: 'same',
    sets: 2,
    equipment: 'none',
    target: { metricType: 'reps' as const, reps: 8 },
    prescription: {
      pattern: 'push_horizontal' as const,
      block: 'main' as const,
      rir: [4, 4] as [number, number],
      restSeconds: 90,
      sourcePosition: 'old',
    },
  };
  const before = {
      id: 'day',
      name: 'Day',
      estimatedMinutes: 20,
      items: [item],
    },
    after = {
      ...before,
      items: [
        {
          ...item,
          prescription: { ...item.prescription, sourcePosition: 'new' },
        },
      ],
    };
  expect(unchangedTemplates([before], [{ ...after, id: 'new-day-id' }])[0].items).toHaveLength(1);
  expect(diffTemplates([before], [after])).toEqual({
    changes: [],
    unchanged: 1,
  });
  expect(diffTemplates([before], [{ ...after, items: [{ ...after.items[0], sets: 3 }] }]).changes).toHaveLength(1);
});
it('warmup and cooldown guidance never displays resistance effort or rest', () => {
  const prescription: EnginePrescription = {
    pattern: 'cardio_cyclic',
    block: 'warmup',
    rir: [4, 4],
    restSeconds: 105,
  };
  expect(renderToStaticMarkup(createElement(PrescriptionDetails, { prescription, locale: 'zh' }))).not.toContain(
    '还能再做',
  );
  expect(renderToStaticMarkup(createElement(PrescriptionDetails, { prescription, locale: 'zh' }))).not.toContain('105');
  expect(
    renderToStaticMarkup(
      createElement(PrescriptionDetails, {
        prescription: { ...prescription, block: 'main' },
        locale: 'zh',
      }),
    ),
  ).toContain('每组做到还能再做 4 次时停');
});
