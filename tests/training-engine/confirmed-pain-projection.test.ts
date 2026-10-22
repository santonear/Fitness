import { describe, it, expect } from 'vitest';
import { nextTargets } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import type { EnginePlan, EngineProfile } from '../../src/engine/contracts';
import type { PlannedItem, WorkoutRecord } from '../../src/domain/v8/contracts';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
const r = new Rules(),
  originalId = 'd16325d9-fc00-4c41-88a1-000000000001',
  replacementId = 'd16325d9-fc00-4c41-88a1-000000000003';
const original: PlannedItem = {
  exerciseId: originalId,
  equipment: 'dumbbell',
  sets: 2,
  target: { metricType: 'reps_load', reps: 12, loadGrams: 10000 },
  prescription: { pattern: 'squat', block: 'main', rir: [3, 4], restSeconds: 90, structure: 'straight' },
};
const replacement: PlannedItem = {
  exerciseId: replacementId,
  equipment: 'none',
  sets: 2,
  target: { metricType: 'reps', reps: 9 },
  prescription: {
    pattern: 'squat',
    block: 'main',
    rir: [3, 4],
    restSeconds: 75,
    structure: 'straight',
    secondsPerRep: 3,
  },
};
function plan(): EnginePlan {
  return {
    weeklyTarget: 1,
    sessionMinutes: 30,
    templates: [
      { id: 'pain-template', name: 'Pain fixture', estimatedMinutes: 30, items: [structuredClone(original)] },
    ],
    meta: { engineVersion: 'fixture', rulesVersion: r.data.rulesVersion, seed: 'fixture' },
    trace: [],
    notices: [],
    gates: [],
  };
}
function profile(): EngineProfile {
  return baseProfile({
    level: 'intermediate',
    trainingAgeWeeks: 52,
    equipment: ['none', 'dumbbell'],
    daysPerWeek: 1,
    cautions: ['knee'],
  });
}
function history(): WorkoutRecord {
  const p = plan();
  return {
    id: 'pain-record',
    templateId: 'pain-template',
    localDate: '2026-10-12',
    timeZone: 'UTC',
    status: 'complete',
    startedAt: '2026-10-12T08:00:00Z',
    endedAt: '2026-10-12T08:30:00Z',
    plannedSetCount: 2,
    templateSnapshot: p.templates[0],
    sets: [
      {
        exerciseId: originalId,
        itemIndex: 0,
        setIndex: 0,
        reps: 12,
        loadGrams: 10000,
        completedAt: '2026-10-12T08:05:00Z',
      },
    ],
    setFeedbackEvents: [
      {
        id: 'pain-event',
        exerciseId: originalId,
        itemIndex: 0,
        setIndex: 0,
        effort: 'discomfort',
        painScore: 4,
        painArea: 'knee',
        createdAt: '2026-10-12T08:05:01Z',
      },
    ],
    painActions: [
      {
        eventId: 'pain-event',
        appliedAt: '2026-10-12T08:06:00Z',
        kind: 'substitute',
        pattern: 'squat',
        itemIndex: 0,
        replacement: structuredClone(replacement),
        redFlagAnswers: Object.fromEntries(r.get('redflag.joint_any').items.map((key: string) => [key, false])),
      },
    ],
  };
}
function later(status: WorkoutRecord['status'] = 'partial', withFacts = true): WorkoutRecord {
  return {
    id: 'next-record',
    templateId: 'pain-template',
    localDate: '2026-10-14',
    timeZone: 'UTC',
    status,
    startedAt: '2026-10-14T08:00:00Z',
    ...(status === 'in_progress' ? {} : { endedAt: '2026-10-14T08:30:00Z' }),
    plannedSetCount: 2,
    sets: withFacts
      ? [{ exerciseId: replacementId, itemIndex: 0, setIndex: 0, reps: 9, completedAt: '2026-10-14T08:05:00Z' }]
      : [],
  };
}
describe('confirmed pain action target projection', () => {
  it('reuses the whole accepted target, preserves facts, and is stable', () => {
    const h = [history()],
      input = plan(),
      before = JSON.stringify({ h, input }),
      a = nextTargets(h, input, profile()),
      b = nextTargets(h, input, profile());
    expect(a.value.templates[0].items[0]).toEqual(replacement);
    expect(a.diff[0]?.kind).toBe('replace');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify({ h, input })).toBe(before);
  });
  it('projects the current in-progress action before any workout is completed', () => {
    const h = history();
    h.status = 'in_progress';
    delete h.endedAt;
    expect(nextTargets([h], plan(), profile()).value.templates[0].items[0]).toEqual(replacement);
  });
  it('holds the exact target throughout the next in-progress session', () => {
    const next = later('in_progress');
    next.setFeedbackEvents = [
      {
        id: 'easy',
        exerciseId: replacementId,
        itemIndex: 0,
        setIndex: 0,
        effort: 'too_light',
        rir: 5,
        createdAt: '2026-10-14T08:06:00Z',
      },
    ];
    const input = plan();
    input.templates[0].items[0] = structuredClone(replacement);
    expect(nextTargets([history(), next], input, profile()).value.templates[0].items[0]).toEqual(replacement);
  });
  it('expires after one actual completed or partial training, without reselecting from the old pain event', () => {
    for (const status of ['complete', 'partial'] as const)
      expect(nextTargets([history(), later(status)], plan(), profile()).value.templates[0].items[0]).toEqual(original);
  });
  it('does not consume the next-training window with an empty or abandoned record', () => {
    for (const entry of [later('not_started', false), later('complete', false), later('abandoned')])
      expect(nextTargets([history(), entry], plan(), profile()).value.templates[0].items[0]).toEqual(replacement);
  });
  it('does not duplicate an already scheduled replacement or select another candidate', () => {
    const input = plan();
    input.templates[0].items.push(structuredClone(replacement));
    const output = nextTargets([history()], input, profile()).value.templates[0].items;
    expect(output).toEqual([replacement]);
  });
  it('does not resume the painful original if the accepted candidate is unsafe for the reported area or unknown answers', () => {
    for (const mode of ['unsafe', 'unknown'] as const) {
      const h = history();
      if (mode === 'unsafe') h.painActions![0].replacement = structuredClone(original);
      else delete h.painActions![0].redFlagAnswers;
      expect(nextTargets([h], plan(), profile()).value.templates).toEqual([]);
    }
  });
  it('leaves a separately edited slot unchanged', () => {
    const input = plan();
    input.templates[0].items[0] = { ...structuredClone(original), exerciseId: 'd16325d9-fc00-4c41-88a1-000000000005' };
    expect(nextTargets([history()], input, profile()).value.templates[0].items[0]).toEqual(input.templates[0].items[0]);
  });
});
it('uses the latest confirmed correction once, without adding a second next-session window', () => {
  const h = history(),
    newer = structuredClone(h.setFeedbackEvents![0]);
  newer.id = 'pain-correction';
  newer.painScore = 5;
  newer.createdAt = '2026-10-12T08:07:00Z';
  h.setFeedbackEvents!.push(newer);
  const newest = structuredClone(replacement);
  newest.target = { metricType: 'reps', reps: 11 };
  h.painActions!.push({
    ...structuredClone(h.painActions![0]),
    eventId: newer.id,
    appliedAt: '2026-10-12T08:08:00Z',
    replacement: newest,
  });
  expect(nextTargets([h], plan(), profile()).value.templates[0].items[0]).toEqual(newest);
  expect(nextTargets([h, later()], plan(), profile()).value.templates[0].items[0]).toEqual(original);
});
it('projects the accepted substitution into another next-session template containing the painful exercise', () => {
  const input = plan();
  input.templates[0].id = 'another-template';
  expect(nextTargets([history()], input, profile()).value.templates[0].items[0]).toEqual(replacement);
});

function reviewed() {
  const h = history();
  (h.painActions![0] as { kind: string }).kind = 'review';
  delete h.painActions![0].replacement;
  return h;
}
it('review without an accepted replacement removes the painful slot for current and next, never choosing a candidate', () => {
  for (const records of [[reviewed()], [reviewed(), later('in_progress')], [reviewed(), later('abandoned')]]) {
    const before = JSON.stringify(records),
      output = nextTargets(records, plan(), profile());
    expect(output.value.templates).toEqual([]);
    expect(output.diff.map(d => d.kind)).toEqual(['remove']);
    expect(JSON.stringify(records)).toBe(before);
  }
});
it('expired review does not reselect from its old discomfort event', () => {
  for (const status of ['complete', 'partial'] as const)
    expect(nextTargets([reviewed(), later(status)], plan(), profile()).value.templates[0].items[0]).toEqual(original);
});
it('review never replaces or removes a later independently selected different exercise', () => {
  const input = plan();
  input.templates[0].items[0] = structuredClone(replacement);
  expect(nextTargets([reviewed()], input, profile()).value.templates[0].items[0]).toEqual(replacement);
});
