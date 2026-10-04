import type { AiRequest } from './contracts';
import type { ExternalSupplier } from './control';
import { ControlError } from './store';

/** Provider-specific request, output and independently justified RMB-fen billing mapping.
 * No provider codec is shipped: selection/review is required before external activation. */
export interface ProviderCodec {
  providerId: string;
  encode(request: AiRequest): unknown;
  decode(body: unknown): { result: unknown; actualCost?: number };
}
export interface TransportConfig {
  endpoint: string; allowedOrigin: string; apiKey: string; timeoutMs: number; maxResponseBytes: number;
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
  return { kind: 'external-transport', call: async request => {
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), config.timeoutMs);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await transport(config.endpoint, { method: 'POST', redirect: 'error', signal: abort.signal,
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(codec.encode(request)) });
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
      return codec.decode(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown);
    } catch { throw new ControlError('SUPPLIER_UNCERTAIN', 503); }
    finally { clearTimeout(timer); reader?.releaseLock(); }
  } };
}
