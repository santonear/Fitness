import { describe, expect, it } from 'vitest';
import { exercises, EXERCISE_IDS } from '../../src/catalog/exercises';
import { GUIDED_DIALOGUE_VERSION, type GuidedDialogueRequest } from '../../src/domain/guided-ai-contracts';
import { confirmGuidedSending, createGuidedDialogueMockClient, guidedInputSnapshot, validateGuidedCandidate, validateGuidedResponse, guidedCandidateMatchesReview } from '../../src/ai/guided-dialogue';

const id = 'd16325d9-fc00-4c41-88a1-000000000001';
const dates = ['2026-10-31', '2026-12-01'];
const limits = { maxDays: 5, maxRangeDays: 100, maxExercisesPerDay: 5, maxSetsPerExercise: 5, maxInputBytes: 10000, maxOutputBytes: 10000 };
const context = { expectedDates: dates, exerciseCatalog: exercises, restoreGeneration: 0, limits };
function candidate() {
  return { id, name: 'Synthetic fixture', goal: 'Fixture goal', startDate: '2026-10-01', endDate: '2026-12-31', timeZone: 'Asia/Shanghai',
    days: dates.map(date => ({ date, exercises: [{ exerciseId: EXERCISE_IDS.bodyweightSquat, order: 0, targetSets: [{ metricType: 'reps' as const, reps: 5 }] }] })),
    explanation: 'Synthetic test only', createdAt: '2026-10-07T00:00:00Z', restoreGeneration: 0 };
}
function request(): GuidedDialogueRequest {
  const input = { version: GUIDED_DIALOGUE_VERSION, conversationId: id, restoreGeneration: 0, purpose: 'program' as const,
    locale: 'zh' as const, scope: { goal: 'Fixture goal', conditions: {} }, startDate: '2026-10-01', endDate: '2026-12-31', timeZone: 'Asia/Shanghai', dates, confirmedSummary: 'Confirmed fixture' };
  return { ...input, requestId: id, inputSnapshot: guidedInputSnapshot(input) };
}
function response(req = request()) {
  return { version: req.version, conversationId: req.conversationId, requestId: req.requestId, restoreGeneration: req.restoreGeneration,
    inputSnapshot: req.inputSnapshot, purpose: 'program', candidate: candidate() };
}
describe('guided AI pure protocol', () => {
  it('candidate confirmation review must match goal, date range, timezone and exact date set', () => {
    const value = candidate(), review = { goal: value.goal, startDate: value.startDate, endDate: value.endDate, timeZone: value.timeZone, dates: [...dates].reverse() };
    expect(guidedCandidateMatchesReview(value, review)).toBe(true);
    for (const changed of [{ goal: 'Different goal' }, { startDate: '2026-10-02' }, { endDate: '2027-01-01' }, { timeZone: 'UTC' }, { dates: [dates[0]] }, { dates: [dates[0], dates[0]] }]) {
      expect(guidedCandidateMatchesReview(value, { ...review, ...changed })).toBe(false);
    }
  });
  it('accepts exact noncontinuous multi-month dates without weekly expansion', () => {
    expect(validateGuidedCandidate(candidate(), context).days.map(day => day.date)).toEqual(dates);
  });
  it('rejects extra, missing and duplicated dates', () => {
    for (const days of [[candidate().days[0]], [...candidate().days, candidate().days[0]], [candidate().days[0], { ...candidate().days[1], date: '2026-11-01' }]]) {
      expect(() => validateGuidedCandidate({ ...candidate(), days }, context)).toThrow();
    }
  });
  it('rejects occupied dates and invalid restore generation', () => {
    expect(() => validateGuidedCandidate(candidate(), { ...context, occupiedDates: [dates[0]] })).toThrow('DATE_CONFLICT');
    expect(() => validateGuidedCandidate(candidate(), { ...context, restoreGeneration: 1 })).toThrow('STALE_RESTORE_GENERATION');
  });
  it('checks catalog metrics and controlled identifiers', () => {
    const value = candidate();
    const mismatched = { ...value, days: value.days.map(day => ({ ...day, exercises: day.exercises.map(exercise => ({ ...exercise, exerciseId: EXERCISE_IDS.plank })) })) };
    expect(() => validateGuidedCandidate(mismatched, context)).toThrow('INVALID_EXERCISE_METRICS');
    expect(() => validateGuidedCandidate({ ...candidate(), days: [{ date: dates[0], exercises: [{ exerciseId: id, order: 0, targetSets: [{ metricType: 'reps', reps: 2, loadGrams: 3 }] }] }] }, context)).toThrow();
  });
  it('uses only explicit capacities, including whole phase span', () => {
    expect(() => validateGuidedCandidate(candidate(), { ...context, limits: { ...limits, maxDays: 1 } })).toThrow('GUIDED_CAPACITY_EXCEEDED');
    expect(() => validateGuidedCandidate(candidate(), { ...context, limits: { ...limits, maxRangeDays: 20 } })).toThrow('GUIDED_CAPACITY_EXCEEDED');
  });
  it('rejects unknown nested fields and old protocol versions', () => {
    expect(() => validateGuidedCandidate({ ...candidate(), unsolicited: true }, context)).toThrow();
    expect(() => validateGuidedResponse({ ...response(), version: 'v1' }, request(), context)).toThrow();
    expect(() => validateGuidedResponse({ ...response(), extra: true }, request(), context)).toThrow();
  });
  it('invalidates consent when input changes, including opted-in history', async () => {
    const req = request(), consent = confirmGuidedSending(req);
    const changed = { ...req, scope: { ...req.scope, history: 'New history' } };
    expect(() => confirmGuidedSending(changed)).toThrow('STALE_SENDING_SCOPE');
    const { requestId: _requestId, inputSnapshot: _snapshot, ...input } = changed;
    changed.inputSnapshot = guidedInputSnapshot(input);
    await expect(createGuidedDialogueMockClient(response, context).send(changed, consent)).rejects.toThrow('STALE_SENDING_SCOPE');
  });
  it('rejects incoming wrong identity, dates, purpose and timezone', () => {
    expect(() => validateGuidedResponse({ ...response(), requestId: 'd16325d9-fc00-4c41-88a1-000000000002' }, request(), context)).toThrow('GUIDED_RESPONSE_IDENTITY_MISMATCH');
    expect(() => validateGuidedResponse({ ...response(), candidate: { ...candidate(), timeZone: 'UTC' } }, request(), context)).toThrow('GUIDED_CANDIDATE_SCOPE_MISMATCH');
    expect(() => validateGuidedResponse({ ...response(), purpose: 'refine' }, request(), context)).toThrow('GUIDED_RESPONSE_IDENTITY_MISMATCH');
  });
  it('mock returns only supplied fixture and is invalid after recovery', async () => {
    const req = request(), consent = confirmGuidedSending(req);
    const client = createGuidedDialogueMockClient(response, context);
    expect(client.mode).toBe('mock');
    expect(await client.send(req, consent)).toEqual(response());
    await expect(createGuidedDialogueMockClient(response, { ...context, restoreGeneration: 1 }).send(req, consent)).rejects.toThrow('STALE_RESTORE_GENERATION');
  });
  it('understanding and clarification are strict, identity-bound non-plan results', () => {
    const req = request();
    for (const purpose of ['understand', 'clarify'] as const) {
      const next = { ...req, purpose };
      const { requestId: _id, inputSnapshot: _snapshot, ...input } = next;
      next.inputSnapshot = guidedInputSnapshot(input);
      const { candidate: _candidate, ...identity } = response(next);
      const output = purpose === 'understand'
        ? { ...identity, purpose, summary: 'Fixture summary', uncertainties: ['Unknown conditions'] }
        : { ...identity, purpose, question: 'Which dates?', field: 'dates' };
      expect(validateGuidedResponse(output, next, context).purpose).toBe(purpose);
      expect(() => validateGuidedResponse({ ...output, field: 'body' }, next, context)).toThrow();
      expect(() => validateGuidedResponse(output, next, { ...context, restoreGeneration: 1 })).toThrow('STALE_RESTORE_GENERATION');
    }
  });
  it('requires refine linkage and consent for the exact new refinement', async () => {
    const req = request();
    const next = { ...req, purpose: 'refine' as const, candidateId: id, refinement: 'Change the explanation only' };
    const { requestId: _id, inputSnapshot: _snapshot, ...input } = next;
    next.inputSnapshot = guidedInputSnapshot(input);
    const consent = confirmGuidedSending(next);
    const client = createGuidedDialogueMockClient(value => ({ ...response(value), purpose: 'refine' }), context);
    expect((await client.send(next, consent)).purpose).toBe('refine');
    await expect(client.send({ ...next, candidateId: undefined }, consent)).rejects.toThrow();
  });
  it('allows understanding and clarification before dates, but requires exact dates for candidates', async () => {
    const { startDate: _start, endDate: _end, dates: _dates, inputSnapshot: _snapshot, ...base } = request();
    for (const purpose of ['understand', 'clarify'] as const) {
      const { requestId: _id, ...input } = { ...base, purpose };
      const next = { ...input, requestId: id, inputSnapshot: guidedInputSnapshot(input) };
      expect(confirmGuidedSending(next).requestId).toBe(id);
      expect(() => confirmGuidedSending({ ...next, scope: { ...next.scope, history: 'private training history' } })).toThrow('GOAL_DIALOGUE_EXCLUDES_BODY_AND_HISTORY');
      expect(() => confirmGuidedSending({ ...next, scope: { ...next.scope, body: { weight: 80 } } })).toThrow('GOAL_DIALOGUE_EXCLUDES_BODY_AND_HISTORY');
    }
    const { requestId: _id, ...input } = base;
    expect(() => confirmGuidedSending({ ...input, requestId: id, inputSnapshot: guidedInputSnapshot(input) })).toThrow('PROGRAM_REQUIRES_EXACT_DATES');
  });
  it('history is excluded by default, and removing or changing selected history invalidates consent', async () => {
    const req = request();
    expect(req.scope.history).toBeUndefined();
    const next = { ...req, scope: { ...req.scope, history: JSON.stringify({ sessions: [], sets: [], bodyWeights: [] }) } };
    const { requestId: _id, inputSnapshot: _snapshot, ...input } = next;
    next.inputSnapshot = guidedInputSnapshot(input);
    const consent = confirmGuidedSending(next);
    await expect(createGuidedDialogueMockClient(response, context).send({ ...next, scope: req.scope }, consent)).rejects.toThrow('STALE_SENDING_SCOPE');
  });
});
