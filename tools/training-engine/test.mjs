import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
const run=(extra)=>{const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...extra],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);};
// Run every functional assertion; keep the large correctness audit in its own process.
// No elapsed-time threshold is part of either group.
if(args.length)run(args);
else {run(['--exclude','tests/training-engine/diagnostic.test.ts']);run(['tests/training-engine/diagnostic.test.ts']);}
