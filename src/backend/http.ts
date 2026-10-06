import { z } from 'zod';
import { ControlService, ControlError } from './control';

const cookieName = '__Host-fitness_trial';
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});
function sessionToken(request: Request) {
  const entries = (request.headers.get('cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${cookieName}=`));
  if (entries.length !== 1) throw new ControlError('QUALIFICATION_REQUIRED', 401);
  const value = entries[0].slice(cookieName.length + 1);
  if (!/^[a-f0-9]{64}$/.test(value)) throw new ControlError('QUALIFICATION_REQUIRED', 401); return value;
}
async function body(request: Request, maxBytes: number) {
  if (!request.headers.get('content-type')?.match(/^application\/json(?:;|$)/i)) throw new ControlError('JSON_REQUIRED', 415);
  const reader = request.body?.getReader(); if (!reader) throw new ControlError('INVALID_INPUT', 400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) { const value = await reader.read(); if (value.done) break; bytes += value.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new ControlError('RANGE_TOO_LARGE', 413); } chunks.push(value.value); }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)) as unknown; }
  catch { throw new ControlError('INVALID_INPUT', 400); }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value); if (!parsed.success) throw new ControlError('INVALID_INPUT', 400); return parsed.data;
}
function cookie(token: string, expiresAt: number) {
  return `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}`;
}
/** Fetch adapter only. No static assets, network calls, telemetry, or browser training writes. */
export function createHandler(service: ControlService, options: { origins: string[]; maxBodyBytes: number; supplierMode?: 'external-transport' }) {
  if (!options.origins.length || !Number.isSafeInteger(options.maxBodyBytes) || options.maxBodyBytes < 1 || options.origins.some(origin => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || url.origin !== origin; } catch { return true; }
  })) throw new ControlError('INVALID_HTTP_CONFIG', 500);
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url), path = url.pathname;
      if (path === '/api/v1/health' && request.method === 'GET') return json({ status: options.supplierMode ?? 'local-mock', productionModelEnabled: false });
      const known = ['/api/v1/trial/redeem', '/api/v1/trial/status', '/api/v1/goals/interpret', '/api/v1/plans/generate', '/api/v1/requests/cancel',
        '/api/v1/admin/invites', '/api/v1/admin/invites/revoke', '/api/v1/admin/revoke', '/api/v1/admin/reissue', '/api/v1/admin/mock', '/api/v1/admin/recovery', '/api/v1/admin/reconciled', '/api/v1/admin/settle', '/api/v1/admin/retention', '/api/v1/admin/report',
        ...(options.supplierMode ? ['/api/v1/admin/supplier'] : [])];
      if (!known.includes(path)) return json({ error: 'NOT_FOUND' }, 404);
      const origin = request.headers.get('origin');
      if (url.protocol !== 'https:' || !options.origins.includes(url.origin) || (origin !== null && !options.origins.includes(origin)) ||
        (request.method !== 'GET' && origin === null) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ControlError('ORIGIN_DENIED', 403);
      if (path === '/api/v1/trial/status') {
        if (request.method !== 'GET') throw new ControlError('METHOD_NOT_ALLOWED', 405);
        return json(await service.status(sessionToken(request)));
      }
      if (request.method !== 'POST') throw new ControlError('METHOD_NOT_ALLOWED', 405);
      const data = await body(request, options.maxBodyBytes);
      if (path === '/api/v1/trial/redeem') {
        const { code } = parse(z.strictObject({ code: z.string().length(64) }), data); const session = await service.redeem(code);
        return json({ subjectId: session.subjectId, expiresAt: session.expiresAt }, 200, { 'Set-Cookie': cookie(session.token, session.expiresAt) });
      }
      if (path.startsWith('/api/v1/admin/')) {
        const authorization = request.headers.get('authorization') ?? '';
        if (!authorization.startsWith('Bearer ')) throw new ControlError('ADMIN_REQUIRED', 401);
        const admin = authorization.slice(7);
        if (path.endsWith('/report')) { parse(z.strictObject({}), data); return json(await service.adminReport(admin)); }
        if (path.endsWith('/invites')) { parse(z.strictObject({}), data); return json(await service.issue(admin)); }
        if (path.endsWith('/mock')) { const { enabled } = parse(z.strictObject({ enabled: z.boolean() }), data); await service.enableMock(admin, enabled); }
        else if (path.endsWith('/supplier')) { const { enabled } = parse(z.strictObject({ enabled: z.boolean() }), data); await service.enableSupplier(admin, enabled); }
        else if (path.endsWith('/retention')) { parse(z.strictObject({}), data); await service.retainLedger(admin); }
        else if (path.endsWith('/recovery')) { parse(z.strictObject({}), data); await service.markLedgerRecovered(admin); }
        else if (path.endsWith('/reconciled')) {
          const evidence = parse(z.strictObject({ budgets: z.record(z.string(), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
            usages: z.record(z.string(), z.strictObject({ understand: z.number().int().nonnegative(), generate: z.number().int().nonnegative() })) }), data);
          await service.confirmReconciled(admin, evidence);
        }
        else if (path === '/api/v1/admin/invites/revoke') { const { inviteId } = parse(z.strictObject({ inviteId: z.string().length(64) }), data); await service.revokeInvite(admin, inviteId); }
        else if (path.endsWith('/settle')) {
          const value = parse(z.strictObject({ subjectId: z.uuid(), requestId: z.uuid(), actualCost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }), data);
          await service.settle(admin, value.subjectId, value.requestId, value.actualCost);
        } else {
          const { subjectId } = parse(z.strictObject({ subjectId: z.uuid() }), data);
          if (path.endsWith('/revoke')) await service.revoke(admin, subjectId);
          else return json(await service.reissue(admin, subjectId));
        }
        return json({ ok: true });
      }
      const token = sessionToken(request);
      if (path.endsWith('/cancel')) { const { requestId } = parse(z.strictObject({ requestId: z.uuid() }), data); await service.cancel(token, requestId); return json({ status: 'cancelled', accounting: 'may-be-charged' }); }
      const operation = (data as { operation?: string } | null)?.operation;
      if (operation !== (path.endsWith('/interpret') ? 'understand' : 'generate')) throw new ControlError('INVALID_INPUT', 400);
      return json(await service.submit(token, data));
    } catch (error) {
      return error instanceof ControlError ? json({ error: error.code }, error.status) : json({ error: 'CONTROL_UNAVAILABLE' }, 503);
    }
  };
}
