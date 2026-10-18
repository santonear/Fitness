// Read-only release smoke check: no sign-in, no writes, no model calls.
// Usage: node tools/release/smoke.mjs https://fitness.initdevl.workers.dev
import { healthPaths } from '../../src/domain/health-paths.ts';
const base = (process.argv[2] ?? process.env.SMOKE_URL ?? '').replace(/\/+$/, '');
if (!/^https:\/\//.test(base)) throw Error('Smoke URL must be https');

const attempts = 6;
const checks = [
  ['real health API', async () => {
    const response = await fetch(base + healthPaths.health);
    if (response.status !== 200) throw Error(`status ${response.status}`);
    const body = await response.json();
    if (!['external-transport','control-only','disabled'].includes(body.status)) {
      throw Error('health status missing or invalid');
    }
  }],
  ['home page', async () => {
    const response = await fetch(base + healthPaths.application, {redirect: 'follow'});
    const body = await response.text();
    if (response.status !== 200) throw Error(`status ${response.status}`);
    if (!/<div id="root"/.test(body)) throw Error('app shell missing');
  }],
  ['feature flags', async () => {
    const response = await fetch(base + healthPaths.features);
    if (response.status !== 200) throw Error(`status ${response.status}`);
    const body = await response.json();
    if (!body || typeof body.flags !== 'object') throw Error('flags missing');
  }],
  ['admin stays closed without sign-in', async () => {
    const response = await fetch(base + healthPaths.admin, {redirect: 'manual'});
    if (response.status === 200 || response.status >= 500) throw Error(`status ${response.status}`);
  }],
];

for (const [name, check] of checks) {
  for (let attempt = 1; ; attempt++) {
    try { await check(); console.log(`ok  ${name}`); break; }
    catch (error) {
      if (attempt >= attempts) { console.error(`FAIL ${name}: ${error.message}`); process.exit(1); }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}
console.log(`Smoke passed for ${base}`);
