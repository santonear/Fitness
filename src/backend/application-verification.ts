export async function verifyApplicationProof(proof: string, secret: string, hostname: string, transport: typeof fetch = fetch) {
  if (!proof || !secret) return false;
  try {
    const response = await transport('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      // Workers rejects redirect: 'error'. Inspect the response without following redirects.
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(5000),
      body: new URLSearchParams({ secret, response: proof }),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    return result.success === true && result.hostname === hostname && result.action === 'trial_application';
  } catch { return false; }
}
