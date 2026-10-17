import {mkdir,copyFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {availableParallelism} from 'node:os';
import {build} from 'esbuild';
const directory=resolve('.cache');await mkdir(directory,{recursive:true});
const backup=resolve(directory,'engine-full-before-ordered-repair.json');try{await access(backup);}catch{await copyFile(resolve(directory,'engine-full.json'),backup);}
const arg=(key,fallback)=>process.argv.find(v=>v.startsWith(key+'='))?.slice(key.length+1)??fallback;
const label=arg('--label','current'),compare=arg('--compare','');if(!/^[a-zA-Z0-9_-]+$/.test(label)||compare&&!/^[a-zA-Z0-9_-]+$/.test(compare)||compare===label)throw Error('Invalid or identical comparison label');
const workers=Number(arg('--workers',String(Math.min(4,availableParallelism())))),limit=Number(arg('--limit','0'));
if(!Number.isInteger(workers)||workers<1||!Number.isInteger(limit)||limit<0)throw Error('Invalid worker count or limit');
const worker=resolve(directory,`engine-audit-worker-regression-${label}-${process.pid}.mjs`),outfile=resolve(directory,`engine-regression-entry-${label}-${process.pid}.mjs`);
await build({entryPoints:['tools/eval/training-engine-audit-worker.ts'],bundle:true,platform:'node',format:'esm',outfile:worker});
const contents=`import {readFile,writeFile} from 'node:fs/promises';import {audit} from './tools/eval/training-engine-audit';import {sampledProfiles,extremeProfiles,goldenProfiles} from './tools/eval/training-engine-profiles';
const read=async p=>JSON.parse(await readFile(p,'utf8'));const original=await read('.cache/engine-full-before-ordered-repair.json'),environment=await read('.cache/c-environment-final.json'),fixed=await read('tests/fixtures/training-engine/problem-profiles.json'),assembled=await read('tests/fixtures/training-engine/assemble-duration-regressions.json');
const sampled=sampledProfiles(2000),extreme=extremeProfiles(200),all=[...sampled,...extreme],fixedByIndex=new Map([...fixed.profiles,...assembled.profiles].map(row=>[row.index,row.profile]));
const problemIndices=[...new Set([...[...fixed.profiles,...assembled.profiles].map(row=>row.index),...environment.indices,...original.coverageMisses])].sort((a,b)=>a-b);for(const index of problemIndices)if(!Number.isInteger(index)||index<0||index>=all.length)throw Error('Invalid global problem index '+index);
const prefix='.cache/regression-${label}',options={workers:${workers},workerUrl:${JSON.stringify(pathToFileURL(worker).href)}};
const groups=[{name:'golden20',profiles:goldenProfiles.map(row=>row.profile),extremes:[],indices:goldenProfiles.map((_,i)=>i)},{name:'80',profiles:sampled.slice(0,80),extremes:[],indices:Array.from({length:80},(_,i)=>i)},{name:'problem',profiles:problemIndices.filter(i=>i<2000).map(i=>fixedByIndex.get(i)??all[i]),extremes:problemIndices.filter(i=>i>=2000).map(i=>fixedByIndex.get(i)??all[i]),indices:problemIndices}];
async function compareOutputs(path,baselinePath){
 const [current,baseline]=await Promise.all([readFile(path,'utf8'),readFile(baselinePath,'utf8')]);
 const now=JSON.parse(current),before=JSON.parse(baseline),byIndex=new Map(now.map(row=>[row.index,row])),oldIndices=new Set(before.map(row=>row.index));
 const removedIndices=before.filter(row=>!byIndex.has(row.index)).map(row=>row.index);
 const changedIndices=before.filter(row=>byIndex.has(row.index)&&JSON.stringify(row)!==JSON.stringify(byIndex.get(row.index))).map(row=>row.index);
 return {outputBytesEqual:current===baseline,commonOutputBytesEqual:removedIndices.length===0&&changedIndices.length===0,addedIndices:now.filter(row=>!oldIndices.has(row.index)).map(row=>row.index),removedIndices,changedIndices};
}
const summary=[];for(const group of groups){if(${limit}>0){group.profiles=group.profiles.slice(0,${limit});group.extremes=[];group.indices=group.indices.slice(0,group.profiles.length);}const report=await audit(group.profiles,prefix+'-'+group.name+'.json',group.extremes,{...options,indices:group.indices,snapshots:prefix+'-'+group.name+'-outputs.json'});const comparison=${JSON.stringify(compare)}?await compareOutputs(prefix+'-'+group.name+'-outputs.json','.cache/regression-'+${JSON.stringify(compare)}+'-'+group.name+'-outputs.json'):{};summary.push({group:group.name,...comparison,indices:group.indices,evaluated:report.evaluated,extremeEvaluated:report.extremeEvaluated,hard:report.actionableHardViolations.length,empty:report.empty,median:report.qualityMedian,p10:report.qualityP10,within10:report.within10Rate,coverage:report.coverageRate,coverageEvaluated:report.coverageEvaluated,performance:report.performance});}await writeFile(prefix+'-manifest.json',JSON.stringify({label:${JSON.stringify(label)},seed:original.seed,problemIndices,summary},null,2));console.log(JSON.stringify(summary));`;
await build({stdin:{contents,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile});if(!process.argv.includes('--prepare-only'))await import(pathToFileURL(outfile).href);
