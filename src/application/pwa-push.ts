import { notificationStatus, pwaRegistration } from './pwa';
// Structural, device-only preference. No training/profile fields are accepted.
export interface BackgroundSchedule { weekdays: number[]; time: string; timeZone: string; quietStart: string; quietEnd: string; dailyLimit: number }
const CAPABILITY = 'fitness.push-capability';
const ENABLED = 'fitness.background-push';
let allowed = false;
export function configureBackgroundPush(enabled: boolean) { allowed = enabled; }
export function backgroundPushEnabled() { try { return localStorage.getItem(ENABLED) === 'true'; } catch { return false; } }
export async function backgroundPushConfig(): Promise<{ enabled: boolean; publicKey?: string }> {
  if (!allowed) return { enabled: false };
  const response = await fetch('/api/v1/push/config', { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) return { enabled: false };
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') return { enabled: false };
  const value = body as Record<string, unknown>;
  return { enabled: value.enabled === true && typeof value.publicKey === 'string' && /^[\w-]{87}$/.test(value.publicKey), publicKey: typeof value.publicKey === 'string' ? value.publicKey : undefined };
}
function deviceCapability() {
  const previous = localStorage.getItem(CAPABILITY); if (previous && /^[\w-]{43}$/.test(previous)) return previous;
  const value = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  localStorage.setItem(CAPABILITY, value); return value;
}
/** Config is fetched before the click, so subscribe is invoked during the gesture. */
export async function enableBackgroundPush(schedule: BackgroundSchedule, publicKey: string): Promise<void> {
  if (!allowed || notificationStatus() !== 'granted') throw Error('PUSH_PERMISSION_REQUIRED');
  const registration = pwaRegistration(); if (!registration?.active || !registration.pushManager) throw Error('PUSH_UNAVAILABLE');
  if (!/^[\w-]{87}$/.test(publicKey)) throw Error('PUSH_UNAVAILABLE');
  const capability = deviceCapability();
  const key = Uint8Array.from(atob(publicKey.replaceAll('-','+').replaceAll('_','/') + '='), character => character.charCodeAt(0));
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const serialized = subscription.toJSON();
  try {
    if (!allowed) throw Error('PUSH_DISABLED');
    const response = await fetch('/api/v1/push/subscription', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${capability}` }, body: JSON.stringify({ subscription: { endpoint: serialized.endpoint, keys: serialized.keys }, schedule: { weekdays: schedule.weekdays, time: schedule.time, timeZone: schedule.timeZone, quietStart: schedule.quietStart, quietEnd: schedule.quietEnd, dailyLimit: schedule.dailyLimit } }) });
    if (!response.ok) throw Error('PUSH_SAVE_FAILED');
    localStorage.setItem(ENABLED, 'true');
  } catch (error) { await subscription.unsubscribe(); throw error; }
}
/** false means browser is unsubscribed but server deletion still needs retry. */
export async function disableBackgroundPush(): Promise<boolean> {
  const registration = pwaRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription && !await subscription.unsubscribe()) return false;
  localStorage.removeItem(ENABLED);
  const capability = localStorage.getItem(CAPABILITY); if (!capability) return true;
  try {
    const response = await fetch('/api/v1/push/subscription', { method: 'DELETE', credentials: 'omit', headers: { Authorization: `Bearer ${capability}` } });
    if (!response.ok) return false;
    localStorage.removeItem(CAPABILITY); return true;
  } catch { return false; }
}
