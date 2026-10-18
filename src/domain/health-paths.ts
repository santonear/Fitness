/**
 * Canonical health-check paths. Every monitor (release smoke script, admin
 * release checks, docs) uses these. Root paths such as `/health` or
 * `/features` are SPA routes that return the app shell HTML, never a probe.
 */
export const healthPaths = {
  health: '/api/v1/health',
  features: '/api/v1/features',
  application: '/',
  managementAccess: '/api/v1/management/console/releases',
  admin: '/admin',
} as const;
