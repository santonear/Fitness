/** Current versions; historical migrations keep their original literals. */
export const DATABASE_VERSION = 21;
export const BACKUP_VERSION = 19;
export const SUPPORTED_BACKUP_VERSIONS = Array.from(
  { length: BACKUP_VERSION - 1 },
  (_, i) => i + 2,
);
