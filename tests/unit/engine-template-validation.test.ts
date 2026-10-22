import { expect, it } from 'vitest';
import { adaptCoachResponse } from '../../src/coach/response-adapter';
import type { CoachRequest, CoachResponse } from '../../src/coach/contracts';
import { Rules } from '../../src/engine/data';
import { runGates } from '../../src/engine/gates';
import { prescribe } from '../../src/engine/dose';
import { baseProfile } from '../../tools/eval/training-engine-profiles';

const rules = new Rules(),
  profile = baseProfile({
    goal: 'muscle',
    level: 'intermediate',
    trainingAgeWeeks: 52,
    equipment: ['none', 'dumbbell', 'flat-bench'],
  });
const exercise = rules.data.exercises.find(row => row.slug === 'arnold-press')!;
const item = prescribe(exercise, profile, rules, runGates(profile, rules).restrictions, 'main', 2);
const id = '11111111-1111-4111-8111-111111111111';
const request: Extract<CoachRequest, { task: 'ADJUST_TODAY' }> = {
  version: 'fitness-coach-v8',
  requestId: id,
  conversationId: id,
  restoreGeneration: 0,
  inputSnapshot: 'explicit synthetic input',
  sendConfirmation: 'preview',
  locale: 'zh',
  timeZone: 'Asia/Shanghai',
  adultConfirmed: true,
  messages: [],
  task: 'ADJUST_TODAY',
  target: { planId: id, versionId: id, revision: 0 },
  trainingEngine: true,
  engineProfile: profile,
  instruction: '调整今天',
  template: { id: 'A', name: 'Training', estimatedMinutes: 30, items: [item] },
};
const response: Extract<CoachResponse, { type: 'today_adjustment' }> = {
  type: 'today_adjustment',
  requestId: id,
  restoreGeneration: 0,
  mutationAllowed: false,
  target: request.target,
  template: request.template,
  summary: '调整今天的训练。',
};

it('accepts the existing source-backed relative-load encoding without inventing zero kilograms', () => {
  expect(item.target.metricType).toBe('reps');
  expect(item.prescription?.loadDescription).toBeDefined();
  expect(adaptCoachResponse(request, response)).toEqual(response);
});
it('rejects an unproved relative load instead of bypassing metric validation', () => {
  const bad = structuredClone(response);
  delete bad.template.items[0].prescription!.loadDescription;
  expect(() => adaptCoachResponse(request, bad)).toThrow('exercise metric mismatch');
});
it('does not silently discard a known weight', () => {
  const known = { ...request, engineProfile: { ...profile, equipmentLoadsKg: { [exercise.id]: 8 } } };
  expect(() => adaptCoachResponse(known, response)).toThrow('exercise metric mismatch');
});
it('keeps the legacy metric contract strict', () => {
  expect(() => adaptCoachResponse({ ...request, trainingEngine: false }, response)).toThrow('exercise metric mismatch');
});
it('rejects a running or jumping candidate under the actual no-jump safety filter', () => {
  const jump = rules.data.exercises.find(row => row.flags.includes('jumping'))!;
  expect(jump).toBeDefined();
  const restricted = { ...profile, constraints: { ...profile.constraints, noJump: true, quiet: true } };
  const bad = structuredClone(response);
  bad.template.items = [prescribe(jump, restricted, rules, runGates(restricted, rules).restrictions, 'main', 1)];
  expect(() => adaptCoachResponse({ ...request, engineProfile: restricted }, bad)).toThrow(
    'exercise outside supplied catalog',
  );
});
it('rejects an actionable engine proposal without a local safety profile', () => {
  expect(() => adaptCoachResponse({ ...request, engineProfile: undefined }, response)).toThrow(
    'exercise outside supplied catalog',
  );
});

it('rejects a fabricated numeric zero instead of the approved unknown-load representation', () => {
  const bad = structuredClone(response);
  bad.template.items[0].target = { metricType: 'reps_load', reps: 8, loadGrams: 0 };
  expect(() => adaptCoachResponse(request, bad)).toThrow('exercise metric mismatch');
});
