import { describe, expect, it, vi } from 'vitest';
import { FeedbackSendError, sendFeedback } from '../../src/application/feedback';
import { disabledFeatures, parseFeatureFlags } from '../../src/domain/feature-flags';

describe('给我们留言 client', () => {
  it('sends only the typed message, optional contact and language', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    const id = crypto.randomUUID();
    const sent = await sendFeedback(
      { id, message: '  想要日历同步  ', contact: ' ', locale: 'zh' },
      fetcher as unknown as typeof fetch,
    );
    expect(sent).toMatchObject({ id, message: '想要日历同步' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/feedback');
    expect(JSON.parse(String(init.body))).toEqual({ id, message: '想要日历同步', locale: 'zh' });
  });
  it('maps refusals to a kept-draft reason and never sends an empty or oversize message', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 429 }));
    await expect(
      sendFeedback({ id: crypto.randomUUID(), message: '好', locale: 'zh' }, fetcher as unknown as typeof fetch),
    ).rejects.toMatchObject({ reason: 'rate' });
    await expect(
      sendFeedback({ id: crypto.randomUUID(), message: '   ', locale: 'zh' }, fetcher as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(FeedbackSendError);
    await expect(
      sendFeedback(
        { id: crypto.randomUUID(), message: 'x'.repeat(1001), locale: 'en' },
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ reason: 'invalid' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(
      sendFeedback({ id: crypto.randomUUID(), message: '好', locale: 'zh' }, offline as unknown as typeof fetch),
    ).rejects.toMatchObject({ reason: 'unavailable' });
  });
});

describe('training reminders flag', () => {
  it('is off unless explicitly enabled', () => {
    expect(disabledFeatures().trainingReminders).toBe(false);
    expect(parseFeatureFlags({}).trainingReminders).toBe(false);
    expect(parseFeatureFlags({ trainingReminders: 'true' }).trainingReminders).toBe(false);
    expect(parseFeatureFlags({ trainingReminders: true }).trainingReminders).toBe(true);
  });
});
