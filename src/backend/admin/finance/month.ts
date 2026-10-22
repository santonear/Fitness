import { DEFAULT_TIME_ZONE, todayIn } from '../../../domain/local-date';
/** Ledger periods follow the same policy timezone as ControlService. */
export function ledgerMonth(now: number, policy?: string): string {
  return todayIn(JSON.parse(policy ?? '{}').timeZone ?? DEFAULT_TIME_ZONE, now).slice(0, 7);
}
