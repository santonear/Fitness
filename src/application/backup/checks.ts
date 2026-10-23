import { DomainError } from '../../domain/errors';
import { utcDay } from '../../domain/local-date';

export function invalid(message: string): never {
  throw new DomainError('BACKUP_REFERENCE_INVALID', message);
}
export function distinct(values: string[], label: string): void {
  if (new Set(values).size !== values.length) invalid(`Duplicate ${label}`);
}
export function validDate(value: string): void {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || utcDay(date) !== value) invalid('Impossible calendar date');
}
