import {z} from 'zod';
import { textIssue } from '../domain/input-guard';
import {digest} from './contracts';
import {D1ControlStore, type D1Binding} from './d1-store';
import {shortId} from './admin/core/short-id';
import type {AdminDatabase} from './admin/core/contracts';

/**
 * 我的 → 给我们留言. The user types a message (and optionally a contact) and
 * explicitly sends it to the app operator. Nothing else is attached: no
 * training, body or chat data. A valid trial cookie adds only the 8-character
 * subject short ID so the operator can match an account; otherwise the
 * message is anonymous. Message text is never logged.
 */
interface FeedbackEnv { ADMIN_DB?: AdminDatabase; CONTROL_DB?: D1Binding; CONTROL_DIGEST_SECRET?: string }
export const FEEDBACK_MESSAGE_MAX = 1000;
export const FEEDBACK_CONTACT_MAX = 100;
/** Per sender (trial subject, or a keyed digest of the connecting address) and per hour. */
export const FEEDBACK_HOURLY_LIMIT = 5;
/** All senders together per UTC day: protects the admin database from floods. */
const FEEDBACK_DAILY_LIMIT = 500;
const MAX_BODY = 8192;
export const feedbackInputSchema = z.strictObject({
  id: z.uuid(),
  message: z.string().trim().min(1).max(FEEDBACK_MESSAGE_MAX).refine(text => !textIssue(text)),
  contact: z.string().trim().max(FEEDBACK_CONTACT_MAX).refine(text => !textIssue(text)).optional(),
  locale: z.enum(['zh', 'en']).optional(),
});
const json = (value: unknown, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});

async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new FeedbackError('INVALID_CONTENT_TYPE', 415);
  const reader = request.body?.getReader(); if (!reader) throw new FeedbackError('INVALID_INPUT', 400);
  let size = 0, text = ''; const decoder = new TextDecoder();
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new FeedbackError('INPUT_TOO_LARGE', 413); }
      text += decoder.decode(part.value, {stream: true}); }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { throw new FeedbackError('INVALID_INPUT', 400); }
}
class FeedbackError extends Error { constructor(public code: string, public status: number) { super(code); } }

/** Identity is optional: an invalid, expired or unreadable trial cookie simply means anonymous. */
async function feedbackSubject(request: Request, env: FeedbackEnv): Promise<string | undefined> {
  try {
    if (!env.CONTROL_DB || !env.CONTROL_DIGEST_SECRET) return;
    const cookies = (request.headers.get('cookie') ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith('__Host-fitness_trial='));
    const token = cookies.length === 1 ? cookies[0].slice('__Host-fitness_trial='.length) : '';
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    const state = await new D1ControlStore(env.CONTROL_DB).read();
    const session = state.sessions[await digest(token, env.CONTROL_DIGEST_SECRET)], subject = session && state.subjects[session.subjectId];
    if (!session || session.revoked || !subject || subject.revoked || subject.deletedAt || subject.expiresAt <= Date.now()) return;
    return session.subjectId;
  } catch { return; }
}
const hourBucket = (now: number) => new Date(now).toISOString().slice(0, 13);
const dayBucket = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Counts first, then refuses: a refused attempt still counts so retries cannot bypass the limit. */
async function admit(db: AdminDatabase, key: string, now: number) {
  const hour = hourBucket(now), day = dayBucket(now);
  // Old buckets carry no meaning after a day; keep the table small.
  await db.prepare('DELETE FROM user_feedback_rate WHERE bucket < ?').bind(dayBucket(now - 86400000)).run();
  const bump = (k: string, bucket: string) => db.prepare('INSERT INTO user_feedback_rate(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1').bind(k, bucket);
  await db.batch([bump(key, hour), bump('*', day)]);
  const own = await db.prepare('SELECT count FROM user_feedback_rate WHERE key=? AND bucket=?').bind(key, hour).first<{count: number}>();
  const all = await db.prepare('SELECT count FROM user_feedback_rate WHERE key=? AND bucket=?').bind('*', day).first<{count: number}>();
  if ((own?.count ?? 0) > FEEDBACK_HOURLY_LIMIT || (all?.count ?? 0) > FEEDBACK_DAILY_LIMIT) throw new FeedbackError('RATE_LIMITED', 429);
}

export async function handleFeedback(request: Request, env: FeedbackEnv, now = Date.now()): Promise<Response> {
  try {
    if (request.method !== 'POST') return json({error: 'METHOD_NOT_ALLOWED'}, 405);
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({error: 'ORIGIN_DENIED'}, 403);
    const parsed = feedbackInputSchema.safeParse(await readBody(request));
    if (!parsed.success) return json({error: 'INVALID_INPUT'}, 400);
    const db = env.ADMIN_DB; if (!db) return json({error: 'SERVICE_UNAVAILABLE'}, 503);
    const input = parsed.data;
    // The same request sent twice (lost response, double tap) is stored once and not counted again.
    if (await db.prepare('SELECT id FROM user_feedback WHERE id=?').bind(input.id).first()) return json({ok: true, id: input.id});
    const subject = await feedbackSubject(request, env);
    const address = request.headers.get('cf-connecting-ip') ?? '';
    const key = subject ? `s:${subject}` : address && env.CONTROL_DIGEST_SECRET ? `a:${(await digest(`feedback:${address}`, env.CONTROL_DIGEST_SECRET)).slice(0, 32)}` : 'anonymous';
    await admit(db, key, now);
    await db.prepare('INSERT OR IGNORE INTO user_feedback(id,created_at,subject_short_id,message,contact,locale,status) VALUES(?,?,?,?,?,?,?)')
      .bind(input.id, now, subject ? shortId(subject) : null, input.message, input.contact || null, input.locale ?? 'zh', 'new').run();
    return json({ok: true, id: input.id}, 201);
  } catch (error) {
    if (error instanceof FeedbackError) return json({error: error.code}, error.status);
    return json({error: 'SERVICE_UNAVAILABLE'}, 503);
  }
}
