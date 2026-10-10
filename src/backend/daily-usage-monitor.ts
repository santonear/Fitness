export interface UsageObservation { day: string; calls: number; costFen?: number; reservedFen: number }
/** Read-only projection: never enables budgets or changes the billing ledger. */
export function assessDailyUsage(value: UsageObservation, limits: { calls: number; costFen: number }, enabled = false) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value.day) &&
    [value.calls, value.reservedFen, limits.calls, limits.costFen].every(n => Number.isSafeInteger(n) && n >= 0) &&
    (value.costFen === undefined || Number.isSafeInteger(value.costFen) && value.costFen >= 0);
  if (!valid) throw new Error('INVALID_USAGE_OBSERVATION');
  const exceeded = value.calls >= limits.calls || (value.costFen ?? 0) + value.reservedFen >= limits.costFen;
  return { day: value.day, calls: value.calls, costFen: value.costFen, reservedFen: value.reservedFen,
    costKnown: value.costFen !== undefined, fallbackRequired: enabled && (exceeded || value.costFen === undefined) };
}
