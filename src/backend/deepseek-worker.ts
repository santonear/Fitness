import { createDeepSeekCodec, DEEPSEEK_ENDPOINT } from './deepseek';
import { createWorker, type WorkerEnv } from './worker';

export interface DeepSeekWorkerEnv extends WorkerEnv { DEEPSEEK_API_KEY?: string }

/** Separate opt-in entrypoint. Configuration and the control ledger both gate model access. */
export function createDeepSeekWorker(dependencies: Pick<NonNullable<Parameters<typeof createWorker>[0]>, 'store' | 'transport'> = {}) {
  const worker = createWorker({ ...dependencies, codec: createDeepSeekCodec({ maxOutputTokens: 2048 }) });
  return { async fetch(request: Request, env: DeepSeekWorkerEnv): Promise<Response> {
    if (env.CONTROL_MODE !== 'external') return worker.fetch(request, env);
    const invalidDestination = (env.SUPPLIER_ENDPOINT !== undefined && env.SUPPLIER_ENDPOINT !== DEEPSEEK_ENDPOINT) ||
      (env.SUPPLIER_ORIGIN !== undefined && env.SUPPLIER_ORIGIN !== 'https://api.deepseek.com');
    if (env.SUPPLIER_PROVIDER !== 'deepseek' || invalidDestination) return new Response(JSON.stringify({
      error: env.SUPPLIER_PROVIDER !== 'deepseek' ? 'PROVIDER_SELECTION_REQUIRED' : 'INVALID_SUPPLIER_CONFIG',
    }), { status: env.SUPPLIER_PROVIDER !== 'deepseek' ? 503 : 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    return worker.fetch(request, { ...env, SUPPLIER_API_KEY: env.DEEPSEEK_API_KEY,
      SUPPLIER_ENDPOINT: DEEPSEEK_ENDPOINT, SUPPLIER_ORIGIN: 'https://api.deepseek.com' });
  } };
}

export default createDeepSeekWorker();
