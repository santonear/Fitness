import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Each child imports the engine from scratch. No prewarming or discarded calls.
await mkdir('.cache', { recursive: true });
const entry = resolve(`.cache/engine-perf-entry-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `import {generatePlan} from './src/engine';
import {sampledProfiles,TRAINING_ENGINE_SEED} from './tools/eval/training-engine-profiles';
import {writeFileSync} from 'node:fs';
const profiles=sampledProfiles(80),durationsMs=[];
for(const profile of profiles){const started=performance.now();generatePlan(profile);durationsMs.push(performance.now()-started);}
writeFileSync(process.argv[2],JSON.stringify({seed:TRAINING_ENGINE_SEED,sampleCount:80,durationsMs,p95Ms:[...durationsMs].sort((a,b)=>a-b)[Math.ceil(80*.95)-1]}));`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: entry,
});

const runs = [];
for (let run = 1; run <= 3; run++) {
  const output = resolve(`.cache/engine-perf-${process.pid}-run-${run}.json`);
  const result = spawnSync(process.execPath, [entry, output], { stdio: 'inherit' });
  if (result.status !== 0) {
    runs.push({ run, error: `Generation process exited ${result.status}` });
  } else {
    runs.push({ run, ...JSON.parse(await readFile(output, 'utf8')) });
  }
}
const complete = runs.every(run => Number.isFinite(run.p95Ms));
const medianP95Ms = complete ? runs.map(run => run.p95Ms).sort((a, b) => a - b)[1] : null;
const report = {
  policy: 'Informational only; never a test or CI timing gate.',
  runs,
  medianP95Ms,
  reportingTargetMs: 400,
  referenceTargetMs: 250,
  withinReportingTarget: complete ? medianP95Ms <= 400 : null,
};
await writeFile('.cache/engine-performance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
