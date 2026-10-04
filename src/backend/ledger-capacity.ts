import { ControlError, type ControlState } from './store';

// Isolated engineering candidate, below D1's 2,000,000-byte row limit with overhead room.
// A single row is NOT an approved production scaling/retention architecture.
export const MAX_LEDGER_JSON_BYTES = 1_900_000;
export function serializeLedger(state: ControlState, maxBytes = MAX_LEDGER_JSON_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_LEDGER_JSON_BYTES) throw new ControlError('INVALID_LEDGER_CAPACITY', 500);
  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > maxBytes) throw new ControlError('CONTROL_CAPACITY_EXHAUSTED', 503);
  return serialized;
}
