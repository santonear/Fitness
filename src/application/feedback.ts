/**
 * 我的 → 给我们留言. Sends only what the user typed (message, optional contact)
 * and the interface language. No training, body or chat data is attached.
 * A copy of each sent message stays on this device so the user can see what
 * they sent; it is not part of backups and never leaves the device again.
 */
export const FEEDBACK_MESSAGE_MAX = 1000;
export const FEEDBACK_CONTACT_MAX = 100;
const historyKey = 'fitness.feedback-sent.v1';
const HISTORY_MAX = 20;
export interface SentFeedback { id: string; at: number; message: string; contact?: string }
export type FeedbackFailure = 'rate' | 'invalid' | 'unavailable';
export class FeedbackSendError extends Error { constructor(public reason: FeedbackFailure) { super(reason); } }

export function sentFeedback(): SentFeedback[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SentFeedback => !!item && typeof item === 'object' && typeof item.id === 'string' && typeof item.at === 'number' && typeof item.message === 'string' && (item.contact === undefined || typeof item.contact === 'string')).slice(0, HISTORY_MAX);
  } catch { return []; }
}
function remember(item: SentFeedback) {
  try { localStorage.setItem(historyKey, JSON.stringify([item, ...sentFeedback().filter(old => old.id !== item.id)].slice(0, HISTORY_MAX))); } catch { /* The message was sent; only the local copy is missing. */ }
}

/** The same `id` may be retried after a lost response; the server stores it once. */
export async function sendFeedback(input: { id: string; message: string; contact?: string; locale: 'zh' | 'en' }, fetcher: typeof fetch = fetch): Promise<SentFeedback> {
  const message = input.message.trim(), contact = input.contact?.trim() || undefined;
  if (!message || message.length > FEEDBACK_MESSAGE_MAX || (contact?.length ?? 0) > FEEDBACK_CONTACT_MAX) throw new FeedbackSendError('invalid');
  let response: Response;
  try {
    response = await fetcher('/api/v1/feedback', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: input.id, message, ...(contact ? { contact } : {}), locale: input.locale }), signal: AbortSignal.timeout(15000) });
  } catch { throw new FeedbackSendError('unavailable'); }
  if (response.status === 429) throw new FeedbackSendError('rate');
  if (response.status === 400) throw new FeedbackSendError('invalid');
  if (!response.ok) throw new FeedbackSendError('unavailable');
  const item: SentFeedback = { id: input.id, at: Date.now(), message, ...(contact ? { contact } : {}) };
  remember(item);
  return item;
}
