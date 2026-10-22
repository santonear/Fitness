import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import type { EnginePlan } from '../../../src/engine/contracts';
import { cardioWorkCap } from '../../../src/engine/fit/cardio-cap';
import { independentCardioDurationIssues } from '../../../src/engine/validation/cardio-duration';
it.each(['walking', 'custom-quiet-march', 'custom-seated-march', 'custom-slow-walking-in-place'])(
  'honors the explicitly approved 600-second whole-action boundary for %s without changing its movement facts',
  slug => {
    const r = new Rules(structuredClone(new Rules().data)),
      p = baseProfile(),
      e = r.data.exercises.find(row => row.slug === slug)!;
    expect(e).toBeDefined();
    const before = JSON.stringify(e);
    expect(cardioWorkCap(e, p, r)).toBe(600);
    const value: EnginePlan = {
      weeklyTarget: 1,
      sessionMinutes: 10,
      templates: [
        {
          id: 'day',
          name: 'test',
          estimatedMinutes: 10,
          targetMinutes: 10,
          items: [
            {
              exerciseId: e.id,
              equipment: 'none',
              sets: 2,
              target: { metricType: 'duration', durationSeconds: 300 },
              prescription: {
                pattern: 'cardio_cyclic',
                block: 'conditioning',
                rir: [4, 5],
                restSeconds: 0,
              },
            },
          ],
        },
      ],
      meta: {
        engineVersion: '2',
        rulesVersion: r.data.rulesVersion,
        seed: 'fixed',
      },
      trace: [],
      notices: [],
      gates: [],
    };
    expect(
      independentCardioDurationIssues(value, p, r, []).some(issue => issue.code === 'independent_cardio_work_cap'),
    ).toBe(false);
    value.templates[0].items[0].target = {
      metricType: 'duration',
      durationSeconds: 300.5,
    };
    expect(independentCardioDurationIssues(value, p, r, [])).toContainEqual(
      expect.objectContaining({ code: 'independent_cardio_work_cap' }),
    );
    r.get('duration.cardio.cap').specialized_caps = [{ when: { field: 'slug', eq: slug }, max_work_seconds: 120 }];
    expect(cardioWorkCap(e, p, r)).toBe(120);
    expect(
      independentCardioDurationIssues(
        {
          ...value,
          templates: [
            {
              ...value.templates[0],
              items: [
                {
                  ...value.templates[0].items[0],
                  sets: 1,
                  target: { metricType: 'duration', durationSeconds: 121 },
                },
              ],
            },
          ],
        },
        p,
        r,
        [],
      ),
    ).toContainEqual(expect.objectContaining({ code: 'independent_cardio_work_cap' }));
    expect(JSON.stringify(e)).toBe(before);
  },
);
