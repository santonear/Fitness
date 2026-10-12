// Refuse to deploy a preview with a config that points at production resources.
// Usage: node tools/release/check-preview-config.mjs wrangler.assistant-preview.jsonc
import {readFile} from 'node:fs/promises';

const path = process.argv[2];
if (!/^wrangler\.[a-z0-9-]*preview[a-z0-9-]*\.jsonc$/.test(path ?? '')) throw Error('Not a preview config');
const strip = text => text.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, string) => string ?? '');
const preview = JSON.parse(strip(await readFile(path, 'utf8')));
const production = JSON.parse(strip(await readFile('wrangler.production.jsonc', 'utf8')));

const ids = config => [
  ...(config.d1_databases ?? []).map(db => db.database_id),
  ...(config.kv_namespaces ?? []).map(kv => kv.id),
];
const shared = ids(preview).filter(id => ids(production).includes(id));
if (preview.name === production.name) throw Error(`Preview uses the production Worker name "${production.name}"`);
if (shared.length) throw Error(`Preview shares production resources: ${shared.join(', ')}`);
if (preview.vars?.ADMIN_ENVIRONMENT === 'production') throw Error('Preview declares ADMIN_ENVIRONMENT=production');
console.log(`Preview config ${path} → Worker "${preview.name}", no production resources`);
