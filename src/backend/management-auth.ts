import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface ManagementEnv {
  ADMIN_ACCESS_ISSUER?: string;
  ADMIN_ACCESS_AUD?: string;
  ADMIN_EMAIL?: string;
}
const keySets = new Map<string, JWTVerifyGetKey>();
const verified = new WeakMap<Request, { actor: string; issuedAt: number }>();
export function administratorIdentity(request: Request) {
  return verified.get(request);
}
/** Only claims from a signature-verified request can satisfy step-up authentication. */
export function requireFreshAccess(request: Request, maxAgeSeconds = 300, now = Date.now()): boolean {
  const identity = verified.get(request);
  return Boolean(
    identity &&
    Number.isInteger(maxAgeSeconds) &&
    maxAgeSeconds > 0 &&
    identity.issuedAt <= now / 1000 &&
    now / 1000 - identity.issuedAt <= maxAgeSeconds,
  );
}
export async function verifyAdministrator(
  request: Request,
  env: ManagementEnv,
  key?: JWTVerifyGetKey,
): Promise<boolean> {
  try {
    const issuer = env.ADMIN_ACCESS_ISSUER;
    if (
      !issuer ||
      !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
      !env.ADMIN_ACCESS_AUD ||
      !env.ADMIN_EMAIL
    )
      return false;
    const token = request.headers.get('cf-access-jwt-assertion');
    if (!token || token.length > 16384) return false;
    if (!key && !keySets.has(issuer))
      keySets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), { timeoutDuration: 5000 }));
    const { payload } = await jwtVerify(token, key ?? keySets.get(issuer)!, {
      issuer,
      audience: env.ADMIN_ACCESS_AUD,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    if (
      typeof payload.email !== 'string' ||
      payload.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase() ||
      !Number.isFinite(payload.iat) ||
      payload.iat! > Date.now() / 1000
    )
      return false;
    verified.set(request, { actor: payload.email.toLowerCase(), issuedAt: payload.iat! });
    return true;
  } catch {
    return false;
  }
}
