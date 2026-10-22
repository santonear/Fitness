import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
await mkdir('.cache', { recursive: true });
const outfile = resolve('.cache/export-engine-samples.mjs');
await build({
  entryPoints: ['tools/training-engine/sample-plans.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});
await import(pathToFileURL(outfile).href);
