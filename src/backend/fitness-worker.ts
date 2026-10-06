import { createDeepSeekWorker, type DeepSeekWorkerEnv } from './deepseek-worker';
export interface FitnessWorkerEnv extends DeepSeekWorkerEnv {
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
/** API routing is explicit: missing API configuration must never become the SPA HTML. */
export function createFitnessWorker(control = createDeepSeekWorker()) {
  return { async fetch(request: Request, env: FitnessWorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) return control.fetch(request, env);
    if (!env.ASSETS) return new Response('Application assets are unavailable', { status: 503 });
    return env.ASSETS.fetch(request);
  } };
}
export default createFitnessWorker();
