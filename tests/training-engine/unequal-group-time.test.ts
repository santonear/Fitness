import { it, expect } from 'vitest';
import { Rules } from '../../src/engine/data';
import { estimatedSeconds } from '../../src/engine/fit/elapsed-time';
import type { Template } from '../../src/engine/dose';
for (const structure of ['superset', 'circuit'] as const)
  it(`counts only actual ${structure} stations in unequal rounds`, () => {
    const r = new Rules(),
      ex = r.data.exercises.filter(e => e.metricType === 'reps' && e.modality === 'strength').slice(0, 2);
    expect(ex.length).toBe(2);
    const t: Template = {
      id: 'unequal',
      name: 'test',
      estimatedMinutes: 10,
      items: ex.map((e, index) => ({
        exerciseId: e.id,
        equipment: e.equipment_required[0],
        sets: index ? 1 : 2,
        target: { metricType: 'reps', reps: 5 },
        prescription: {
          pattern: e.primary_pattern,
          block: 'main',
          rir: [3, 4],
          restSeconds: 60,
          secondsPerRep: e.time.s_per_rep ?? r.get('duration.rep.seconds').default_if_unknown,
          perSide: e.time.per_side,
          structure,
          groupId: 'g',
        },
      })),
    };
    const one = estimatedSeconds(t, r);
    t.items[1].sets++;
    const e = ex[1],
      p = t.items[1].prescription!,
      row = r.get('duration.rest.block')[structure],
      side = e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
    expect(estimatedSeconds(t, r) - one).toBe(
      5 * p.secondsPerRep! * side +
        r.get('duration.set.overhead').overhead_s_per_set +
        (row.between_exercises_s ?? row.between_stations_s),
    );
  });
