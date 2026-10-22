import type { Announcement } from '../backend/admin/finance/runtime';
let cached: Announcement | null = null;
let checkedAt = -Infinity;
let pending: Promise<Announcement | null> | undefined;
/** Shared between page mounts. A failed refresh retains only a still-active notice. */
export function readAnnouncement(transport: typeof fetch = fetch): Promise<Announcement | null> {
  const current = () => (cached && cached.start <= Date.now() && cached.end > Date.now() ? cached : null);
  if (pending) return pending;
  if (Date.now() - checkedAt < 60_000) return Promise.resolve(current());
  checkedAt = Date.now();
  pending = (async () => {
    try {
      const response = await transport('/api/v1/announcement', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error('ANNOUNCEMENT_UNAVAILABLE');
      const { announcement } = await response.json();
      if (announcement === null) cached = null;
      else if (
        announcement &&
        typeof announcement.text === 'string' &&
        Number.isFinite(announcement.start) &&
        Number.isFinite(announcement.end) &&
        announcement.end > announcement.start
      )
        cached = announcement;
    } catch {
      /* A notice cannot block the user's local training. */
    }
    return current();
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
