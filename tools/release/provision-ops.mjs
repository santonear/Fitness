import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

/** Runs only in the protected production job; credentials stay in GitHub secrets. */
export function provisionOperations({read = readFileSync, write = writeFileSync,
  run = args => execFileSync('npx', ['wrangler', ...args], {encoding:'utf8'}),
  env = process.env} = {}) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main' ||
      !env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
    throw Error('Protected main production job required');
  }
  const file = 'wrangler.production.jsonc';
  const config = JSON.parse(read(file, 'utf8'));
  const binding = config.d1_databases.find(db => db.binding === 'FITNESS_OPS_DB');
  if (config.name !== 'fitness' || binding?.database_name !== 'fitness-ops-production') {
    throw Error('Unexpected operations database target');
  }
  const list = () => JSON.parse(run(['d1','list','--json']));
  let databases = list();
  if (!databases.some(db => db.name === binding.database_name)) {
    run(['d1','create',binding.database_name,'--update-config=false']);
    databases = list();
  }
  const matches = databases.filter(db => db.name === binding.database_name);
  if (matches.length !== 1 || !/^[a-f0-9-]{36}$/i.test(matches[0].uuid)) {
    throw Error('Operations database identity not verified');
  }
  binding.database_id = matches[0].uuid;
  // Only resolve the ID of this newly declared binding in the ephemeral checkout.
  write(file, JSON.stringify(config, null, 2) + '\n');
  run(['d1','migrations','apply','FITNESS_OPS_DB','--remote','--config',file]);
  console.log('Operations binding and migrations verified; flags unchanged');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  provisionOperations();
}
