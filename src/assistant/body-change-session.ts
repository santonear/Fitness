import type { BodyChange } from './body-change';

export interface BodyReferral {
  kind: BodyChange;
  dismissed: Set<BodyChange>;
}
const memory = new Map<string, BodyReferral>();
const prefix = 'fitness-local-body-referral:';
const kinds: BodyChange[] = ['pregnancy', 'postpartum', 'health'];

/** Tab-scoped UI state only. Never included in conversation backups or network requests. */
export function readBodyReferral(id: string): BodyReferral | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + id) ?? 'null');
    if (value && kinds.includes(value.kind) && Array.isArray(value.dismissed))
      return {
        kind: value.kind,
        dismissed: new Set(value.dismissed.filter((kind: BodyChange) => kinds.includes(kind))),
      };
  } catch {
    /* Memory retains the card when session storage is unavailable. */
  }
  return memory.get(id);
}
export function writeBodyReferral(id: string, row: BodyReferral): void {
  memory.set(id, row);
  try {
    sessionStorage.setItem(prefix + id, JSON.stringify({ kind: row.kind, dismissed: [...row.dismissed] }));
  } catch {
    /* Keep this conversation usable without storage. */
  }
}
export function clearBodyReferral(id: string): void {
  memory.delete(id);
  try {
    sessionStorage.removeItem(prefix + id);
  } catch {
    /* No network or durable fallback. */
  }
}
