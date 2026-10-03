export type DomainErrorCode = 'INVALID' | 'CONFLICT' | 'STORAGE_FULL' | 'SESSION_READ_ONLY' | 'ACTIVE_SESSION_EXISTS' | 'WORKOUT_IN_PROGRESS' | 'EMPTY_WORKOUT' | 'INVALID_RANGE' | 'EMPTY_STAGE' | 'RANGE_TOO_LARGE' | 'BACKUP_INVALID' | 'BACKUP_TOO_LARGE' | 'BACKUP_VERSION_UNSUPPORTED' | 'BACKUP_REFERENCE_INVALID' | 'BACKUP_CONFIRMATION_REQUIRED' | 'IMPORT_IN_PROGRESS' | 'CALENDAR_PROVENANCE_MISSING';
export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
