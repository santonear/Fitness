/** Pure wire fingerprints shared by browser and server; no backend runtime dependencies. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function hex(value: ArrayBuffer) { return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join(''); }
function confirmedPayload(value: unknown) {
  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => !['requestId', 'sendConfirmation', 'goalConfirmation'].includes(key));
  return Object.fromEntries(entries);
}
/** Public content fingerprint, binds confirmation to actual fields; it is not an identity credential. */
export async function confirmationFor(value: unknown) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(confirmedPayload(value)))));
}
export async function goalConfirmationFor(value: { goalText: string; confirmedGoal: string }) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ goalText: value.goalText, confirmedGoal: value.confirmedGoal }))));
}
