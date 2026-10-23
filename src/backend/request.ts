import type { ControlState } from './store';
import type { AdminDatabase } from './admin/core/contracts';
import { digest } from './contracts';
import { DAY_MS, utcDay } from '../domain/local-date';

/** Shared request plumbing for the Worker endpoints. Each caller keeps its own limits and error codes. */

/** JSON response that is never cached. */
export const noStoreJson = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

/** Sent by this site's own pages: same Origin, not cross-site, and (unless `https` is false) over HTTPS. */
export function sameOrigin(request: Request, https = true): boolean {
  const url = new URL(request.url);
  return (
    (!https || url.protocol === 'https:') &&
    request.headers.get('origin') === url.origin &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  );
}

export type BodyProblem = 'missing' | 'too-large' | 'invalid';
/**
 * Request body bytes, reading no more than `maxBytes` (the stream is cancelled as soon as the limit is
 * passed). `fail` turns a problem into the caller's own error; a missing body is empty when `allowMissing`.
 */
export async function readBodyBytes(
  request: Request,
  maxBytes: number,
  fail: (problem: BodyProblem) => unknown,
  allowMissing = false,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) {
    if (allowMissing) return new Uint8Array();
    throw fail('missing');
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw fail('too-large');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
/** Size-limited JSON body; text that does not decode or parse becomes `fail('invalid')`. */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
  fail: (problem: BodyProblem) => unknown,
  decoder = new TextDecoder(),
): Promise<unknown> {
  const bytes = await readBodyBytes(request, maxBytes, fail);
  try {
    return JSON.parse(decoder.decode(bytes)) as unknown;
  } catch {
    throw fail('invalid');
  }
}

export const TRIAL_COOKIE = '__Host-fitness_trial';
/** The trial session token, only when exactly one well-formed trial cookie is present. */
export function trialToken(request: Request): string | undefined {
  const cookies = (request.headers.get('cookie') ?? '')
    .split(';')
    .map(value => value.trim())
    .filter(value => value.startsWith(`${TRIAL_COOKIE}=`));
  const token = cookies.length === 1 ? cookies[0].slice(TRIAL_COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
/** Subject of a trial token while its session and subject are neither revoked, deleted nor expired. */
export async function activeTrialSubject(
  state: ControlState,
  token: string,
  digestSecret: string,
  now = Date.now(),
): Promise<string | undefined> {
  const session = state.sessions[await digest(token, digestSecret)],
    subject = session && state.subjects[session.subjectId];
  if (!session || session.revoked || !subject || subject.revoked || subject.deletedAt || subject.expiresAt <= now)
    return undefined;
  return session.subjectId;
}

/** Rate-limit key for one sender: the trial subject, else a keyed digest of the connecting address (never the raw address). */
export async function senderKey(request: Request, purpose: string, secret?: string, subject?: string) {
  if (subject) return `s:${subject}`;
  const address = request.headers.get('cf-connecting-ip') ?? '';
  return address && secret ? `a:${(await digest(`${purpose}:${address}`, secret)).slice(0, 32)}` : 'anonymous';
}
/**
 * Counts first, then answers whether to refuse: a refused attempt still counts so retries cannot bypass the limit.
 * Every limiter shares the admin table `user_feedback_rate` (migrations/admin/6); `scope` keeps their keys apart
 * (feedback uses the empty scope). Buckets older than a day are cleared, they carry no user content.
 */
export async function overRateLimit(
  db: AdminDatabase,
  scope: string,
  sender: string,
  limits: { hourly: number; daily: number },
  now: number,
): Promise<boolean> {
  const hour = new Date(now).toISOString().slice(0, 13),
    day = utcDay(now);
  await db
    .prepare('DELETE FROM user_feedback_rate WHERE bucket < ?')
    .bind(utcDay(now - DAY_MS))
    .run();
  const bump = (key: string, bucket: string) =>
    db
      .prepare(
        'INSERT INTO user_feedback_rate(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1',
      )
      .bind(key, bucket);
  const own = `${scope}${sender}`,
    all = `${scope}*`;
  await db.batch([bump(own, hour), bump(all, day)]);
  const read = (key: string, bucket: string) =>
    db
      .prepare('SELECT count FROM user_feedback_rate WHERE key=? AND bucket=?')
      .bind(key, bucket)
      .first<{ count: number }>();
  return ((await read(own, hour))?.count ?? 0) > limits.hourly || ((await read(all, day))?.count ?? 0) > limits.daily;
}
