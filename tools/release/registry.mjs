// Builds ADMIN_RELEASE_REGISTRY for one deploy so the admin "flags & releases"
// page and its rollback guard describe the version actually published.
// No secrets or user data are read; inputs are git metadata and the JSON
// that `wrangler deployments status --json` / `wrangler versions view --json`
// print for the version that is live before this deploy.
//
// Usage (CI):
//   node tools/release/registry.mjs --deployment prev-deployment.json --version prev-version.json \
//     --out-registry registry.json --out-message message.txt --out-tag tag.txt
// Env: RELEASE_SHA, RELEASE_SUBJECT (commit subject), RELEASE_ENVIRONMENT, SMOKE_ORIGIN, RELEASE_PR (optional)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { RELEASE_DATA_VERSION } from '../../src/domain/release-data-version.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A placeholder that the running Worker replaces with its own CF_VERSION_METADATA id.
export const PENDING_DEPLOYMENT_ID = '00000000-0000-4000-8000-000000000000';

export function pullRequestNumber(subject = '', explicit = '') {
  const value = String(explicit).trim() || subject.match(/\(#(\d+)\)\s*$/)?.[1] || subject.match(/^Merge pull request #(\d+)/)?.[1];
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}
export function releaseId(sha, pr) {
  if (!/^[a-f0-9]{7,40}$/.test(sha)) throw Error('RELEASE_SHA must be a git sha');
  return pr ? `pr${pr}-${sha.slice(0, 7)}` : `sha-${sha.slice(0, 7)}`;
}
export function releaseMessage({ id, sha, pr, dataVersion = RELEASE_DATA_VERSION }) {
  return `release=${id} data=${dataVersion} sha=${sha.slice(0, 7)}${pr ? ` pr=${pr}` : ''}`;
}
/** Version id that receives (most of) the traffic in a `deployments status --json` document. */
export function liveVersionId(deployment) {
  const doc = Array.isArray(deployment) ? deployment[0] : deployment;
  const versions = Array.isArray(doc?.versions) ? doc.versions : [];
  const best = [...versions].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
  const id = best?.version_id ?? best?.versionId ?? best?.id;
  return typeof id === 'string' && uuid.test(id) ? id : undefined;
}
/** Registration for the live version, from the annotations this script wrote when it was deployed. */
export function previousRegistration(deployment, version, smokeOrigin) {
  const id = liveVersionId(deployment);
  if (!id) return undefined;
  const annotations = version?.annotations ?? version?.metadata?.annotations ?? {};
  const message = String(annotations['workers/message'] ?? '');
  const created = version?.metadata?.created_on ?? version?.created_on ?? deployment?.created_on;
  const publishedAt = typeof created === 'string' && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : undefined;
  if (!publishedAt) return undefined;
  const registered = message.match(/(?:^|\s)release=([\w.-]{1,80})(?:\s|$)/)?.[1];
  const legacy = message.match(/^release ([a-f0-9]{7,40}) run \d+/)?.[1];
  const sha = message.match(/(?:^|\s)sha=([a-f0-9]{7,40})(?:\s|$)/)?.[1] ?? legacy;
  const data = message.match(/(?:^|\s)data=(\d+)(?:\s|$)/)?.[1];
  const pr = Number(message.match(/(?:^|\s)pr=(\d+)(?:\s|$)/)?.[1]);
  return {
    id: registered ?? (sha ? `sha-${sha.slice(0, 7)}` : `cf-${id.slice(0, 8)}`),
    deploymentId: id,
    publishedAt,
    // An older deploy without a registered data version stays visible but can never be a rollback target.
    ...(data ? { compatibleDataVersion: Number(data) } : {}),
    smokeOrigin,
    ...(sha ? { commit: sha } : {}),
    ...(Number.isSafeInteger(pr) && pr > 0 ? { pr } : {}),
  };
}
export function buildRegistry({ environment, sha, subject, pr: explicitPr, smokeOrigin, deployment, version, now = new Date() }) {
  if (!['preview', 'production'].includes(environment)) throw Error('RELEASE_ENVIRONMENT must be preview or production');
  const origin = new URL(smokeOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== smokeOrigin) throw Error('SMOKE_ORIGIN must be an https origin');
  const pr = pullRequestNumber(subject, explicitPr);
  const id = releaseId(sha, pr);
  const previous = previousRegistration(deployment, version, smokeOrigin);
  const current = { id, deploymentId: PENDING_DEPLOYMENT_ID, publishedAt: now.toISOString(), compatibleDataVersion: RELEASE_DATA_VERSION, smokeOrigin, commit: sha, ...(pr ? { pr } : {}) };
  return {
    registry: [{ environment, dataVersion: RELEASE_DATA_VERSION, current, ...(previous && previous.id !== id ? { previous } : {}) }],
    message: releaseMessage({ id, sha, pr }),
    tag: id.slice(0, 25),
  };
}

function readJson(path) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; } }
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const arg = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
  const result = buildRegistry({
    environment: process.env.RELEASE_ENVIRONMENT ?? 'production',
    sha: process.env.RELEASE_SHA ?? '',
    subject: process.env.RELEASE_SUBJECT ?? '',
    pr: process.env.RELEASE_PR ?? '',
    smokeOrigin: process.env.SMOKE_ORIGIN ?? '',
    deployment: arg('deployment') ? readJson(arg('deployment')) : undefined,
    version: arg('version') ? readJson(arg('version')) : undefined,
  });
  writeFileSync(arg('out-registry') ?? 'registry.json', JSON.stringify(result.registry));
  writeFileSync(arg('out-message') ?? 'message.txt', result.message);
  writeFileSync(arg('out-tag') ?? 'tag.txt', result.tag);
  const entry = result.registry[0];
  console.log(`current ${entry.current.id}; previous ${entry.previous ? `${entry.previous.id} (${entry.previous.deploymentId})` : 'not registered'}`);
}
