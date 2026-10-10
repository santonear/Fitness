import type { TransportRequest as AiRequest } from './contracts';
import type { ExternalSupplier } from './control';
import { ControlError } from './store';

/** Provider-specific request, output and independently justified RMB-fen billing mapping.
 * No provider codec is shipped: selection/review is required before external activation. */
export interface ProviderCodec {
  providerId: string;
  credentialHeader?: 'x-goog-api-key';
  encode(request: AiRequest): unknown | Promise<unknown>;
  decode(body: unknown): { result: unknown; actualCost?: number };
  costUpperBoundFen?(request: AiRequest): number | undefined;
}
export interface TransportConfig {
  endpoint: string; allowedOrigin: string; apiKey: string; timeoutMs: number; maxResponseBytes: number;
  onFailure?: (event: { stage: 'encode' | 'network' | 'http' | 'decode' | 'timeout'; httpStatus?: number }) => void;
}
export function assertOperatorSecret(secret: unknown): asserts secret is string {
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 4096 || /\s|local-test|placeholder|example|changeme/i.test(secret))
    throw new ControlError('INVALID_SUPPLIER_CONFIG', 500);
}
export function createSupplierTransport(config: TransportConfig, codec: ProviderCodec, transport: typeof fetch): ExternalSupplier {
  try {
    const url = new URL(config.endpoint), origin = new URL(config.allowedOrigin);
    assertOperatorSecret(config.apiKey);
    if (url.protocol !== 'https:' || url.origin !== config.allowedOrigin || origin.origin !== config.allowedOrigin ||
      url.username || url.password || url.search || url.hash || !codec.providerId || codec.providerId === 'unselected' ||
      !Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 120_000 ||
      !Number.isSafeInteger(config.maxResponseBytes) || config.maxResponseBytes < 1 || config.maxResponseBytes > 1_048_576)
      throw new Error('invalid');
  } catch { throw new ControlError('INVALID_SUPPLIER_CONFIG', 500); }
  return { kind: 'external-transport', costUpperBoundFen: request => codec.costUpperBoundFen?.(request), call: async request => {
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), config.timeoutMs);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let stage: 'encode' | 'network' | 'http' | 'decode' = 'encode'; let httpStatus: number | undefined;
    try {
      const encoded = JSON.stringify(await codec.encode(request));
      stage = 'network';
      const response = await transport(config.endpoint, { method: 'POST', redirect: 'manual', signal: abort.signal,
        headers: { ...(codec.credentialHeader === 'x-goog-api-key'
          ? { 'x-goog-api-key': config.apiKey } : { Authorization: `Bearer ${config.apiKey}` }),
          'Content-Type': 'application/json', Accept: 'application/json' },
        body: encoded });
      stage = 'http'; httpStatus = response.status;
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error('uncertain');
      }
      reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > config.maxResponseBytes) { await reader.cancel(); throw new Error('uncertain'); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      stage = 'decode';
      return codec.decode(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown);
    } catch {
      // Optional operator diagnostics contain bounded stages/status only, never URLs, keys or bodies.
      try { config.onFailure?.({ stage: abort.signal.aborted ? 'timeout' : stage, ...(httpStatus === undefined ? {} : { httpStatus }) }); } catch { /* Diagnostics cannot change accounting semantics. */ }
      throw new ControlError('SUPPLIER_UNCERTAIN', 503);
    }
    finally { clearTimeout(timer); reader?.releaseLock(); }
  } };
}
