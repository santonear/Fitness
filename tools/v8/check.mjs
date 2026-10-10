import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coachCopyViolations } from './coach-language.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function violations(file, source) {
  const found = [];
  const ui = /src\/(ui|themes|i18n|admin)\//.test(file);
  const tokenFile = /^src\/themes\/[^/]+\/tokens\.css$/.test(file);
  if (ui && !tokenFile && /\[data-theme/.test(source)) found.push('theme-selector');
  if (/^src\/ui\/(pages|components)\//.test(file)) {
    if (/#[\da-f]{3,8}\b|\brgba?\(/i.test(source)) found.push('literal-color');
    if (/font-family|fontFamily/.test(source)) found.push('font-family');
  }
  if (ui && /AI\s*架构评审|契约示例|评测面板|Prompt\s*结构/.test(source)) found.push('developer-entry');
  found.push(...coachCopyViolations(file, source));
  return found;
}
async function walk(dir) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat();
}
export async function scan() {
  const results = [];
  for (const file of [...await walk('src'), ...await walk('tests/backend'), ...await walk('tests/fixtures')]) {
    if (!/\.(css|tsx?|json)$/.test(file)) continue;
    const rules = violations(file, await readFile(path.join(root, file), 'utf8'));
    for (const rule of rules) results.push(`${file}:${rule}`);
  }
  return results.sort();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseline = JSON.parse(await readFile(path.join(root, 'tools/v8/legacy-baseline.json'), 'utf8'));
  const actual = await scan();
  const added = actual.filter(x => !baseline.includes(x));
  if (added.length) { console.error(added.join('\n')); process.exitCode = 1; }
  console.log(`V8 styles: ${added.length} new violations; ${actual.length} total rule/file pairs.`);
}
