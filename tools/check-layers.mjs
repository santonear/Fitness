// Layer guard: lower layers must not import higher ones, so a change in a page cannot ripple into
// the database or the training engine. Usage: node tools/check-layers.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const src = join(root, 'src');
// layer -> layers it must never import
const forbidden = {
  domain: ['application', 'persistence', 'ui', 'backend', 'themes', 'coach', 'ai', 'assistant'],
  engine: ['application', 'persistence', 'ui', 'backend', 'themes', 'coach', 'ai', 'assistant'],
  persistence: ['application', 'ui', 'backend', 'themes'],
  application: ['ui'],
};

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) files.push(path);
  }
})(src);

const layerOf = path => relative(src, path).split('/')[0];
const violations = [];
for (const file of files) {
  const from = layerOf(file);
  const banned = forbidden[from];
  if (!banned) continue;
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), spec);
    if (!target.startsWith(src + '/')) continue;
    const to = layerOf(target);
    if (banned.includes(to)) violations.push(`${relative(root, file)} -> ${relative(root, target)} (${from} must not import ${to})`);
  }
}

if (violations.length) {
  console.error(`Layer check: ${violations.length} forbidden import(s)\n  ` + violations.join('\n  '));
  process.exit(1);
}
console.log(`Layer check: ${files.length} files, no forbidden imports.`);
