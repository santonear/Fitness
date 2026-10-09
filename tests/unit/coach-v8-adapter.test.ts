import { describe, expect, it } from 'vitest';
import { EXERCISE_IDS, exercises } from '../../src/catalog/exercises';
import { adaptCoachResponse, coachV8Exercises } from '../../src/coach/response-adapter';
import type { CoachRequest } from '../../src/coach/contracts';
import { coachPromptHeader, coachV8PromptHeader } from '../../src/backend/coach-prompt-registry';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const common = { version: 'fitness-coach-v8' as const, requestId: id, conversationId: id, restoreGeneration: 2,
  inputSnapshot: 'scope', sendConfirmation: 'confirmed', locale: 'zh' as const, timeZone: 'Asia/Shanghai', adultConfirmed: true as const, messages: [] };
const target = { planId: id, versionId: id, revision: 4 };
const template = { id: 'A', name: 'A', estimatedMinutes: 20, items: [{ exerciseId: EXERCISE_IDS.bodyweightSquat, equipment: 'none', sets: 2, target: { metricType: 'reps' as const, reps: 8 } }] };
const profile = { goalText: '练出习惯', weeklyTarget: 2, sessionMinutes: 20, scheduleOriginalText: '每次20分钟', place: 'home' as const, equipment: [], adultConfirmed: true as const, cautions: [] };
const proposal = { goalText: profile.goalText, weeklyTarget: 2, sessionMinutes: 20, scheduleOriginalText: profile.scheduleOriginalText, templates: [template, { ...template, id: 'B' }], reasons: ['a', 'b', 'c'] };
const timingBands = { morning: { partial: 1, notStarted: 0 }, daytime: { partial: 0, notStarted: 2 }, evening: { partial: 0, notStarted: 0 } };
const incompleteTiming = { weekday: timingBands, weekend: timingBands };
const identity = { requestId: id, restoreGeneration: 2, mutationAllowed: false };
const onboard: CoachRequest = { ...common, task: 'ONBOARD_PLAN', profile };
const cases: { request: CoachRequest; response: Record<string, unknown> }[] = [
  { request: onboard, response: { ...identity, type: 'plan_proposal', proposal } },
  { request: { ...common, task: 'ADJUST_TODAY', target, workoutId: id, template, instruction: 'shorter' }, response: { ...identity, type: 'today_adjustment', target, workoutId: id, template, summary: 'shorter' } },
  { request: { ...common, task: 'MODIFY_PLAN', target, plan: { ...proposal, reasons: ['a', 'b', 'c'] }, instruction: 'change' }, response: { ...identity, type: 'change_proposal', target, proposal, changes: ['change'] } },
  { request: { ...common, task: 'PERIOD_REVIEW', target, kind: 'week', facts: { from: '2026-10-01', to: '2026-10-07', complete: 0, partial: 0, notStarted: 4, movementCount: 0, missingCount: 0, activityMinutes: 0, trainingSeconds: 0, activityCounts: { walk: 0, run: 0, cycle: 0, swim: 0, yoga: 0, stairs: 0, other: 0 }, reasonCounts: { time: 0, fatigue: 0, discomfort: 0, equipment_busy: 0, not_today: 0, other: 0 }, hasBodyWeight: false, incompleteTiming, improvements: [] } }, response: { ...identity, type: 'review_summary', target, opening: 'a', encouragement: 'b', gap: 'c', dataBoundary: ['d'] } },
];

describe('V8 response boundary', () => {
  it.each(cases)('accepts $request.task without mutating inputs', ({ request, response }) => {
    const before = JSON.stringify({ request, response });
    expect(adaptCoachResponse(request, JSON.stringify(response))).toEqual(response);
    expect(JSON.stringify({ request, response })).toBe(before);
  });
  it.each(cases)('checks identity and universal replies for $request.task', ({ request, response }) => {
    for (const patch of [{ requestId: other }, { restoreGeneration: 1 }, { mutationAllowed: true }]) {
      expect(() => adaptCoachResponse(request, { ...response, ...patch })).toThrow();
    }
    for (const reply of [{ type: 'clarify', question: 'Which?' }, { type: 'refused', reason: 'Unavailable' }]) {
      expect(adaptCoachResponse(request, { ...identity, ...reply }).type).toBe(reply.type);
      expect(() => adaptCoachResponse(request, { ...identity, ...reply, requestId: other })).toThrow();
    }
  });
  it('rejects cross-task responses and all stale target dimensions', () => {
    cases.forEach(({ request }, index) => cases.forEach(({ response }, otherIndex) => {
      if (index !== otherIndex) expect(() => adaptCoachResponse(request, response)).toThrow();
    }));
    for (const { request, response } of cases.slice(1)) {
      for (const patch of [{ planId: other }, { versionId: other }, { revision: 5 }]) {
        expect(() => adaptCoachResponse(request, { ...response, target: { ...target, ...patch } })).toThrow();
      }
    }
    for (const workoutId of [other, undefined]) expect(() => adaptCoachResponse(cases[1].request, { ...cases[1].response, workoutId })).toThrow();
  });
  it('preserves actual minutes and original words, with 2–3 initial templates', () => {
    for (const minutes of [15, 20, 120]) {
      const response = { ...cases[0].response, proposal: { ...proposal, sessionMinutes: minutes, templates: proposal.templates.map(template => ({ ...template, estimatedMinutes: minutes })) } };
      expect(adaptCoachResponse({ ...onboard, profile: { ...profile, sessionMinutes: minutes } }, response).type).toBe('plan_proposal');
    }
    for (const minutes of [15, 30, 60, 120]) {
      const templates = proposal.templates.map(template => ({ ...template, estimatedMinutes: minutes }));
      expect(() => adaptCoachResponse(onboard, { ...cases[0].response, proposal: { ...proposal, templates } })).toThrow('initial template duration');
    }
    for (const patch of [{ sessionMinutes: 30 }, { goalText: 'new' }, { scheduleOriginalText: 'translated' }, { weeklyTarget: 3 }, { templates: [template] }, { templates: Array.from({ length: 4 }, (_, i) => ({ ...template, id: String(i) })) }]) {
      expect(() => adaptCoachResponse(onboard, { ...cases[0].response, proposal: { ...proposal, ...patch } })).toThrow();
    }
  });
  it('rejects unknown/out-of-scope IDs and wrong metrics', () => {
    const outside = exercises.find(exercise => !coachV8Exercises(onboard).some(row => row.id === exercise.id))!;
    for (const patch of [{ exerciseId: other }, { exerciseId: outside.id }, { target: { metricType: 'duration', durationSeconds: 30 } }]) {
      const templates = [{ ...template, items: [{ ...template.items[0], ...patch }] }, { ...template, id: 'B' }];
      expect(() => adaptCoachResponse(onboard, { ...cases[0].response, proposal: { ...proposal, templates } })).toThrow();
    }
  });
  it('bounds payloads, dialogue, adulthood and rejects legacy data in the new path', () => {
    for (const patch of [{ messages: Array(9).fill({ role: 'user', content: 'x' }) }, { messages: [{ role: 'user', content: 'x'.repeat(1601) }] }, { adultConfirmed: false }, { inputSnapshot: '中'.repeat(30000) }]) {
      expect(() => adaptCoachResponse({ ...onboard, ...patch } as CoachRequest, cases[0].response)).toThrow();
    }
    expect(() => adaptCoachResponse(onboard, 'x'.repeat(131073))).toThrow();
    expect(() => adaptCoachResponse(onboard, { ...identity, type: 'program' })).toThrow();
    expect(coachV8Exercises(onboard).length).toBeLessThanOrEqual(64);
  });
  it('validates optional review proposals and template identities', () => {
    const review = cases[3];
    const suggestion = { id: 's1', summary: 'Try this', proposal };
    expect(adaptCoachResponse(review.request, { ...review.response, suggestion }).type).toBe('review_summary');
    expect(() => adaptCoachResponse(review.request, { ...review.response, suggestion: { ...suggestion, proposal: { ...proposal, templates: [template, template] } } })).toThrow();
    expect(() => adaptCoachResponse(review.request, { ...review.response, suggestions: [suggestion, suggestion] })).toThrow();
    const adjustment = cases[1].request;
    if (adjustment.task !== 'ADJUST_TODAY') throw new Error('fixture');
    expect(() => adaptCoachResponse({ ...adjustment, workoutId: undefined }, cases[1].response)).toThrow();
  });
  it('accepts review boundary arrays including empty and rejects legacy strings', () => {
    const review = cases[3];
    for (const dataBoundary of [[], ['No body-weight records.'], ['a', 'b']]) {
      expect(adaptCoachResponse(review.request, { ...review.response, dataBoundary })).toEqual({ ...review.response, dataBoundary });
    }
    for (const dataBoundary of ['legacy', [''], [1], undefined]) {
      expect(() => adaptCoachResponse(review.request, { ...review.response, dataBoundary })).toThrow();
    }
  });
  it('requires complete nonnegative timing facts without changing them', () => {
    const review = cases[3];
    const request = review.request;
    if (request.task !== 'PERIOD_REVIEW') throw new Error('fixture');
    for (const timing of [undefined, {}, { ...incompleteTiming, weekday: { ...timingBands, morning: { partial: -1, notStarted: 0 } } }]) {
      expect(() => adaptCoachResponse({ ...request, facts: { ...request.facts, incompleteTiming: timing } } as CoachRequest, review.response)).toThrow();
    }
    const facts = { ...request.facts, from: '2026-09-01', to: '2026-09-30' };
    expect(adaptCoachResponse({ ...request, kind: 'month', facts }, review.response).type).toBe('review_summary');
    expect(facts.incompleteTiming).toEqual(incompleteTiming);
  });
  it('does not inherit legacy eight movement or eight set limits', () => {
    const large = { ...template, items: Array.from({ length: 9 }, () => ({ ...template.items[0], sets: 9 })) };
    expect(adaptCoachResponse(onboard, { ...cases[0].response, proposal: { ...proposal, templates: [large, { ...large, id: 'B' }] } }).type).toBe('plan_proposal');
  });
  it('versions V8 prompts independently and retains legacy prompts', () => {
    expect(coachPromptHeader('create')).toContain('@v7.1.0');
    cases.forEach(({ request }) => expect(coachV8PromptHeader(request.task)).toContain('@v8.0.0'));
    expect(coachV8PromptHeader('ONBOARD_PLAN')).toContain('20 means 20');
    expect(coachV8PromptHeader('PERIOD_REVIEW')).toContain('not_started is excluded');
    expect(coachV8PromptHeader('PERIOD_REVIEW')).toContain('dataBoundary is a string array');
    expect(coachV8PromptHeader('PERIOD_REVIEW')).toContain('otherwise return []');
    expect(coachV8PromptHeader('PERIOD_REVIEW')).toContain('incompleteTiming');
  });
});

