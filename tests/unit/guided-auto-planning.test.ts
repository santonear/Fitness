import { expect, it } from 'vitest';
import { guidedInputSnapshot } from '../../src/ai/guided-dialogue';
import { guidedTransportEnvelope } from '../fixtures/legacy-guided-envelope';
import { validateCandidate, validateRequest } from '../../src/backend/contracts';
import { fourMetricCandidate } from '../fixtures/prompt-cases';

it('allows AI to choose a nonempty subset only for explicitly authorized automatic scheduling', async () => {
  const input = {
    version: 'guided-dialogue-v1' as const,
    conversationId: crypto.randomUUID(),
    restoreGeneration: 0,
    purpose: 'program' as const,
    locale: 'en' as const,
    scope: { goal: 'Train once a week', conditions: {} },
    confirmedSummary: 'Train once a week',
    timeZone: 'Asia/Shanghai',
    dateSelection: 'ai' as const,
    startDate: '2026-10-08',
    endDate: '2026-10-14',
    dates: ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'],
  };
  const request = { ...input, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(input) };
  const envelope = await guidedTransportEnvelope(request);
  await expect(validateRequest(envelope, 7, 65536)).resolves.toMatchObject({ operation: 'generate' });
  const raw = {
    kind: 'program',
    name: 'Weekly plan',
    explanation: 'One training day and recovery days',
    days: [{ ...fourMetricCandidate().days[0], date: input.dates[2] }],
  };
  expect(validateCandidate(envelope, raw)).toMatchObject({ candidate: { days: [{ date: input.dates[2] }] } });
  for (const days of [[], [...raw.days, ...raw.days], [{ ...raw.days[0], date: '2026-10-15' }]]) {
    expect(() => validateCandidate(envelope, { ...raw, days })).toThrow();
  }
  const { dateSelection: _mode, ...exactInput } = input;
  const exact = await guidedTransportEnvelope({
    ...exactInput,
    requestId: crypto.randomUUID(),
    inputSnapshot: guidedInputSnapshot(exactInput),
  });
  expect(() => validateCandidate(exact, raw)).toThrow('INVALID_CANDIDATE');
});
