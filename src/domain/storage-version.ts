/** Current versions; historical migrations keep their original literals. */
export const DATABASE_VERSION = 20;
export const BACKUP_VERSION = 18;
export const SUPPORTED_BACKUP_VERSIONS = Array.from(
  { length: BACKUP_VERSION - 1 },
  (_, i) => i + 2,
);
