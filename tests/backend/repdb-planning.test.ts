import { expect, it } from 'vitest';
import { exercises } from '../../src/catalog/exercises';
import { selectAiExercises } from '../../src/catalog/ai-catalog';
import { buildAiPrompt } from '../fixtures/legacy-prompt';
import { validateCandidate, confirmationFor, goalConfirmationFor } from '../../src/backend/contracts';
import { validateGuidedProviderOutput } from '../../src/backend/legacy-guided-reader';
import { guidedInputSnapshot } from '../../src/ai/guided-dialogue';
import { promptRequest } from '../fixtures/prompt-cases';

it('classic generation accepts a new movement, rejects wrong metrics and non-shortlisted IDs', async () => {
  const base = await promptRequest('en'); if (base.operation !== 'generate') throw Error('fixture');
  const request = { ...base, goalText: 'Arnold Press', confirmedGoal: 'Arnold Press' };
  request.goalConfirmation = await goalConfirmationFor(request); request.sendConfirmation = await confirmationFor(request);
  const exercise = exercises.find(row => row.name.en === 'Arnold Press')!;
  const candidate = { days: [{ date: request.dates[0], exercises: [{ exerciseId: exercise.id, order: 0, targetSets: [{ metricType: 'reps_load', reps: 8, loadGrams: 2000 }] }] }] };
  expect(validateCandidate(request, candidate)).toEqual(candidate);
  expect(() => validateCandidate(request, { days: [{ ...candidate.days[0], exercises: [{ ...candidate.days[0].exercises[0], targetSets: [{ metricType: 'duration', durationSeconds: 60 }] }] }] })).toThrow('INVALID_CANDIDATE');
  const allowed = new Set(selectAiExercises(request.confirmedGoal, request.conditions).map(row => row.id));
  const outside = exercises.find(row => !allowed.has(row.id))!;
  expect(() => validateCandidate(request, { days: [{ ...candidate.days[0], exercises: [{ ...candidate.days[0].exercises[0], exerciseId: outside.id }] }] })).toThrow('INVALID_CANDIDATE');
  const prompt = await buildAiPrompt(request);
  expect(prompt.messages[0].content).toContain(exercise.id);
  expect(prompt.messages[0].content).not.toMatch(/exercise-media|sourceVersion|repdb\.co|instructions_en/);
});

it('guided generation includes the new controlled ID and retains the confirmation envelope', () => {
  const input = { version: 'guided-dialogue-v1' as const, conversationId: crypto.randomUUID(), restoreGeneration: 0,
    purpose: 'program' as const, locale: 'en' as const, scope: { goal: 'Arnold Press', conditions: { equipment: 'dumbbell' } },
    confirmedSummary: 'Arnold Press', timeZone: 'Asia/Shanghai', startDate: '2026-10-09', endDate: '2026-10-09', dates: ['2026-10-09'] };
  const request = { ...input, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(input) };
  const exercise = exercises.find(row => row.name.en === 'Arnold Press')!;
  const result = validateGuidedProviderOutput(request, { kind: 'program', name: 'Test', explanation: 'Synthetic candidate', days: [{ date: '2026-10-09', exercises: [{ exerciseId: exercise.id, order: 0, targetSets: [{ metricType: 'reps_load', reps: 8, loadGrams: 2000 }] }] }] });
  expect(result).toMatchObject({ purpose: 'program', requestId: request.requestId, inputSnapshot: request.inputSnapshot });
});
