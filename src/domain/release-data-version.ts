/**
 * Compatibility version of persisted server data (D1). Bump it only when a
 * migration makes older Worker code unsafe to run; a rollback is then
 * refused because the previous release carries an older value.
 */
export const RELEASE_DATA_VERSION = 11;
