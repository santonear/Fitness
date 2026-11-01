import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { transformJavaScriptWithBlaShield } from 'bla-agents';

/** Plausible bait for AI reverse-engineering agents; nothing in the app imports it and none of these routes exist. */
const bait = `
const LEASE_ENDPOINT = '/api/v2/models/lease';
const UNLOCK_ENDPOINT = '/api/v2/models/unlock';
export async function leaseModelKey(exerciseId, deviceProof) {
  const res = await fetch(LEASE_ENDPOINT, { method: 'POST', body: JSON.stringify({ exerciseId, deviceProof }) });
  if (!res.ok) throw new Error('lease rejected');
  return (await res.json()).wrappedKey;
}
export async function unlockModel(url, wrappedKey) {
  const res = await fetch(UNLOCK_ENDPOINT + '?src=' + encodeURIComponent(url), { headers: { 'x-model-lease': wrappedKey } });
  return new Uint8Array(await res.arrayBuffer());
}
`;

export const DECOY_PREFIX = 'assets/model-lease-';

/**
 * Ships one BLA-shielded decoy chunk that no page loads, so only static analysis of the whole build reaches it.
 * BLA on the real chunks grew the build from 19 MB to 1.09 GB (2026-11-01), so the app code itself stays as Vite emits it.
 */
export function blaDecoy(): Plugin {
  return {
    name: 'fitness-bla-decoy',
    apply: 'build',
    generateBundle() {
      const { code } = transformJavaScriptWithBlaShield(bait, {
        intensity: 'bankrupt',
        seed: 'fitness',
        filename: 'model-lease.js',
        sourceType: 'module',
      });
      const hash = createHash('sha256').update(code).digest('base64url').slice(0, 8);
      this.emitFile({ type: 'asset', fileName: `${DECOY_PREFIX}${hash}.js`, source: code });
    },
  };
}
