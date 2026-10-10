import { importJWK, SignJWT } from 'jose';
import { z } from 'zod';

export const pushSchedule = z.object({
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timeZone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dailyLimit: z.number().int().min(0).max(2),
}).strict();
export type PushSchedule = z.infer<typeof pushSchedule>;
export function validPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));
  } catch { return false; }
}
export const pushSubscription = z.object({ endpoint: z.string().max(4096).refine(validPushEndpoint), keys: z.object({ p256dh: z.string().regex(/^[\w-]{87}$/), auth: z.string().regex(/^[\w-]{22}$/) }).strict() }).strict();
export function duePushDay(schedule: PushSchedule, now: number, checkTime = true): string | undefined {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: schedule.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now).map(part => [part.type, part.value]));
  const weekday = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(parts.weekday) + 1;
  const time = `${parts.hour}:${parts.minute}`;
  const quiet = schedule.quietStart < schedule.quietEnd ? time >= schedule.quietStart && time < schedule.quietEnd : schedule.quietStart > schedule.quietEnd && (time >= schedule.quietStart || time < schedule.quietEnd);
  if (schedule.dailyLimit === 0 || quiet || !schedule.weekdays.includes(weekday) || (checkTime && time !== schedule.time)) return undefined;
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export async function capabilityHash(token: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
/** RFC 8292 VAPID; empty-body RFC 8030 wakeup, no health payload. */
export async function sendGenericPush(endpoint: string, privateJwk: string, publicKey: string, subject: string, now: number, transport: typeof fetch = fetch): Promise<number> {
  if (!validPushEndpoint(endpoint) || !/^https:\/\/|^mailto:/.test(subject)) throw Error('INVALID_PUSH_CONFIGURATION');
  const key = await importJWK(JSON.parse(privateJwk), 'ES256');
  const jwt = await new SignJWT({}).setProtectedHeader({ typ: 'JWT', alg: 'ES256' }).setAudience(new URL(endpoint).origin).setSubject(subject).setExpirationTime(Math.floor(now / 1000) + 3600).sign(key);
  const response = await transport(endpoint, { method: 'POST', redirect: 'error', headers: { Authorization: `vapid t=${jwt}, k=${publicKey}`, TTL: '60', Urgency: 'normal' }, body: new Uint8Array(0), signal: AbortSignal.timeout(10000) });
  return response.status;
}
