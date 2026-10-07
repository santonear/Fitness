import { expect, it } from 'vitest';
import { nextPlanningWindow } from '../../src/ai/guided-planning';
import { guidedInputSnapshot } from '../../src/ai/guided-dialogue';
import { guidedTransportEnvelope } from '../../src/ai/guided-transport';
import { validateCandidate, validateRequest } from '../../src/backend/contracts';
import { fourMetricCandidate } from '../fixtures/prompt-cases';
import { guidedProviderPrompt } from '../../src/backend/guided-provider';

it('uses tomorrow and seven calendar days in the user timezone across year and DST boundaries', () => {
  expect(nextPlanningWindow(Date.parse('2026-12-31T17:00:00Z'), 'Asia/Shanghai').dates).toEqual([
    '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08',
  ]);
  expect(nextPlanningWindow(Date.parse('2026-03-07T20:00:00Z'), 'America/New_York').dates).toEqual([
    '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14',
  ]);
});

it('allows AI to choose a nonempty subset only for explicitly authorized automatic scheduling', async () => {
  const input = { version: 'guided-dialogue-v1' as const, conversationId: crypto.randomUUID(), restoreGeneration: 0,
    purpose: 'program' as const, locale: 'en' as const, scope: { goal: 'Train once a week', conditions: {} },
    confirmedSummary: 'Train once a week', timeZone: 'Asia/Shanghai', dateSelection: 'ai' as const,
    ...nextPlanningWindow(Date.parse('2026-10-07T00:00:00Z'), 'Asia/Shanghai') };
  const request = { ...input, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(input) };
  const envelope = await guidedTransportEnvelope(request);
  expect(guidedProviderPrompt(request)[0].content).toContain('GENERATE a complete actionable training plan');
  expect(guidedProviderPrompt(request)[0].content).toContain('ALLOWED window');
  expect(guidedProviderPrompt(request)[0].content).toContain('rest intervals');
  await expect(validateRequest(envelope, 7, 65536)).resolves.toMatchObject({ operation: 'generate' });
  const raw = { kind: 'program', name: 'Weekly plan', explanation: 'One training day and recovery days',
    days: [{ ...fourMetricCandidate().days[0], date: input.dates[2] }] };
  expect(validateCandidate(envelope, raw)).toMatchObject({ candidate: { days: [{ date: input.dates[2] }] } });
  for (const days of [[], [...raw.days, ...raw.days], [{ ...raw.days[0], date: '2026-10-15' }]]) {
    expect(() => validateCandidate(envelope, { ...raw, days })).toThrow();
  }
  const { dateSelection: _mode, ...exactInput } = input;
  const exact = await guidedTransportEnvelope({ ...exactInput, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(exactInput) });
  expect(() => validateCandidate(exact, raw)).toThrow('INVALID_CANDIDATE');
});
