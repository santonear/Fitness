// Decide how much of the browser suite a pull request needs (Bo 2026-10-22).
//   none  - only docs/Markdown changed: no browser tests
//   admin - only the admin area changed: admin browser tests only
//   full  - anything else, and every push, nightly and manual run
// Shared code (domain, application, persistence, components) is used by every page, so it
// always means full. Writes `scope=<value>` to $GITHUB_OUTPUT when that variable is set.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const docs = /^(docs\/|outputs\/)|\.md$/;
const admin = /^(src\/ui\/admin\/|src\/backend\/admin\/|tests\/admin\/)/;

export function scopeFor(files) {
  if (!files.length) return 'full';
  if (files.every(file => docs.test(file))) return 'none';
  if (files.every(file => docs.test(file) || admin.test(file))) return 'admin';
  return 'full';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.env.BASE_SHA;
  let scope = 'full';
  if (process.env.GITHUB_EVENT_NAME === 'pull_request' && base) {
    const files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
    scope = scopeFor(files);
    console.log(`${files.length} changed file(s) -> scope ${scope}`);
  } else console.log(`${process.env.GITHUB_EVENT_NAME ?? 'local'} run -> scope full`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scope=${scope}\n`);
}
