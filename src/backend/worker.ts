import { z } from 'zod';
import { ControlService, type ControlConfig } from './control';
import { D1ControlStore, type D1Binding } from './d1-store';
import { createHandler } from './http';
import { ControlError, type ControlStore } from './store';
import { verifyApplicationProof } from './application-verification';
import { assertOperatorSecret, createSupplierTransport, type ProviderCodec, type TransportConfig } from './supplier-transport';

export interface WorkerEnv {
  TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string;
  CONTROL_MODE?: string; CONTROL_ORIGINS?: string; CONTROL_POLICY?: string;
  CONTROL_ADMIN_SECRET?: string; CONTROL_DIGEST_SECRET?: string;
  SUPPLIER_API_KEY?: string; SUPPLIER_ENDPOINT?: string; SUPPLIER_ORIGIN?: string; SUPPLIER_PROVIDER?: string;
  CONTROL_DB?: D1Binding;
}
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const policy = z.strictObject({ timeZone: z.string().min(1), k: count.min(1).max(14), budgetLimit: count,
  allowBoundedPending: z.boolean().optional(), planningBudgetDisabled: z.boolean().optional(), maximumRequestCost: count, requestBounds: z.strictObject({ understand: count, generate: count, summary: count.optional() }),
  quotas: z.strictObject({ understand: count, generate: count, summary: count.optional() }), maxInputBytes: count.min(1).max(65536), maxConcurrent: count.min(1).max(100) });
type WorkerConfig = { control: ControlConfig; origins: string[] } &
  ({ mode: 'control-only' } | { mode: 'external'; transport: TransportConfig; providerId: string });
export function readWorkerConfig(env: WorkerEnv): WorkerConfig | null {
  if (env.CONTROL_MODE === undefined || env.CONTROL_MODE === 'disabled') return null;
  if (env.CONTROL_MODE !== 'external' && env.CONTROL_MODE !== 'control-only') throw new ControlError('INVALID_CONTROL_CONFIG', 500);
  try {
    assertOperatorSecret(env.CONTROL_ADMIN_SECRET); assertOperatorSecret(env.CONTROL_DIGEST_SECRET);
    if (env.CONTROL_ADMIN_SECRET === env.CONTROL_DIGEST_SECRET) throw new Error('distinct secrets required');
    const values = policy.parse(JSON.parse(env.CONTROL_POLICY ?? ''));
    if (values.allowBoundedPending && (values.budgetLimit !== 3000 || values.maximumRequestCost !== 300 || Object.values(values.requestBounds).some(value => value !== 300))) throw new Error('invalid bounded-pending policy');
    new Intl.DateTimeFormat('en', { timeZone: values.timeZone });
    if (Object.values(values.requestBounds).some(cost => cost > values.maximumRequestCost || cost > values.budgetLimit)) throw new Error('invalid bounds');
    const origins = z.array(z.string().url()).min(1).max(8).parse(JSON.parse(env.CONTROL_ORIGINS ?? ''));
    if (origins.some(value => { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value; })) throw new Error('invalid origin');
    const control: ControlConfig = { ...values, mode: 'external', adminSecret: env.CONTROL_ADMIN_SECRET, digestSecret: env.CONTROL_DIGEST_SECRET };
    if (env.CONTROL_MODE === 'control-only') return { mode: 'control-only', control, origins };
    assertOperatorSecret(env.SUPPLIER_API_KEY);
    if ([env.CONTROL_ADMIN_SECRET, env.CONTROL_DIGEST_SECRET].includes(env.SUPPLIER_API_KEY)) throw new Error('distinct secrets required');
    if (!env.SUPPLIER_PROVIDER || env.SUPPLIER_PROVIDER === 'unselected') throw new ControlError('PROVIDER_SELECTION_REQUIRED', 503);
    const transport = { endpoint: env.SUPPLIER_ENDPOINT ?? '', allowedOrigin: env.SUPPLIER_ORIGIN ?? '', apiKey: env.SUPPLIER_API_KEY,
      timeoutMs: 30_000, maxResponseBytes: 262_144 };
    // Validate destination before constructing a store or granting supplier access.
    createSupplierTransport(transport, { providerId: env.SUPPLIER_PROVIDER, encode: () => null, decode: () => ({ result: null }) }, fetch);
    return { mode: 'external', control, origins, transport, providerId: env.SUPPLIER_PROVIDER };
  } catch (error) { if (error instanceof ControlError && error.code === 'PROVIDER_SELECTION_REQUIRED') throw error; throw new ControlError('INVALID_CONTROL_CONFIG', 500); }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
/** Executable assembly; shipped default has no provider codec and cannot activate external calls. */
export function createWorker(dependencies: { store?: (env: WorkerEnv) => ControlStore; codec?: ProviderCodec; transport?: typeof fetch } = {}) {
  return { async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      const config = readWorkerConfig(env);
      if (!config) return new URL(request.url).pathname === '/api/v1/health' && request.method === 'GET'
        ? json({ status: 'disabled', productionModelEnabled: false }) : json({ error: 'AI_DISABLED' }, 503);
      const path = new URL(request.url).pathname;
      if (config.mode === 'control-only' && ['/api/v1/goals/interpret', '/api/v1/plans/generate', '/api/v1/stages/summarize', '/api/v1/admin/supplier', '/api/v1/admin/mock'].includes(path))
        return json({ error: 'AI_DISABLED' }, 503);
      if (config.mode === 'external' && (!dependencies.codec || dependencies.codec.providerId !== config.providerId)) throw new ControlError('PROVIDER_SELECTION_REQUIRED', 503);
      const supplier = config.mode === 'external'
        ? createSupplierTransport(config.transport, dependencies.codec!, dependencies.transport ?? fetch)
        : { kind: 'external-transport' as const, call: async () => { throw new ControlError('AI_DISABLED', 503); } };
      const store = dependencies.store ? dependencies.store(env) : env.CONTROL_DB ? new D1ControlStore(env.CONTROL_DB) : null;
      if (!store) throw new ControlError('CONTROL_UNAVAILABLE', 503);
      if (config.mode === 'control-only' && path === '/api/v1/health' && request.method === 'GET')
        return json({ status: 'control-only', productionModelEnabled: false });
      const service = new ControlService(store, config.control, supplier);
      return createHandler(service, { origins: config.origins, maxBodyBytes: config.control.maxInputBytes,
        ...(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY ? { turnstileSiteKey: env.TURNSTILE_SITE_KEY,
          verifyApplication: (proof: string) => verifyApplicationProof(proof, env.TURNSTILE_SECRET_KEY!, new URL(request.url).hostname) } : {}),
        supplierMode: 'external-transport' })(request);
    } catch (error) { return error instanceof ControlError ? json({ error: error.code }, error.status) : json({ error: 'CONTROL_UNAVAILABLE' }, 503); }
  } };
}
export default createWorker();
