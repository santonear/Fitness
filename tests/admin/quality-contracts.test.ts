import { describe, expect, it } from 'vitest';
import {
  errorEvent,
  evaluationReport,
  notificationSettings,
  defaultSettings,
  notificationAllowed,
  isSpike,
} from '../../src/backend/admin/quality/contracts';
import { collectError } from '../../src/backend/admin/quality/service';

describe('quality privacy and notification contracts', () => {
  const event = { type: 'storage', route: '/workout', version: '1.0.0', browser: 'Safari', os: 'iOS', time: 1000 };
  it('accepts only enumerated error metadata, rejects free text, identifiers and query routes', () => {
    expect(errorEvent.safeParse(event).success).toBe(true);
    for (const field of ['message', 'stack', 'ip', 'userId', 'input', 'health'])
      expect(errorEvent.safeParse({ ...event, [field]: 'secret' }).success).toBe(false);
    for (const mutation of [
      { route: '/workout?user=person' },
      { type: 'personal text' },
      { browser: 'full user agent' },
      { version: 'email@example.com' },
    ])
      expect(errorEvent.safeParse({ ...event, ...mutation }).success).toBe(false);
  });
  it('cannot enable error collection implicitly', async () => {
    expect(
      (await collectError(new Request('https://test', { method: 'POST', body: JSON.stringify(event) }), {})).status,
    ).toBe(503);
  });
  it('requires synthetic evaluations without prompt or model output', () => {
    const report = {
      id: crypto.randomUUID(),
      synthetic: true,
      time: 1000,
      promptVersion: 'v1',
      model: 'synthetic',
      scenarios: [{ scenario: 'tone', passed: true, violations: 0 }],
      durationMs: 10,
      costMicros: 0,
    };
    expect(evaluationReport.safeParse(report).success).toBe(true);
    expect(evaluationReport.safeParse({ ...report, synthetic: false }).success).toBe(false);
    expect(evaluationReport.safeParse({ ...report, output: 'secret' }).success).toBe(false);
  });
  it('uses strictly greater than triple a seven-day same-hour baseline, minimum ten', () => {
    expect(isSpike(9, [0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(isSpike(10, [0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(isSpike(12, [4, 4, 4, 4, 4, 4, 4])).toBe(false);
    expect(isSpike(13, [4, 4, 4, 4, 4, 4, 4])).toBe(true);
  });
  it('requires urgent categories, honors overnight quiet hours and urgent exemptions', () => {
    const now = Date.parse('2026-10-11T15:00:00Z'); // 23:00 Shanghai
    expect(notificationAllowed('errors', defaultSettings, now)).toBe(false);
    for (const category of ['ledger', 'smoke', 'budget100'] as const) {
      expect(notificationAllowed(category, defaultSettings, now)).toBe(true);
      expect(
        notificationSettings.safeParse({
          ...defaultSettings,
          enabled: { ...defaultSettings.enabled, [category]: false },
        }).success,
      ).toBe(false);
    }
    expect(notificationAllowed('applications', defaultSettings, Date.parse('2026-10-11T01:00:00Z'))).toBe(true);
    expect(notificationAllowed('test', defaultSettings, now)).toBe(true);
  });
});
