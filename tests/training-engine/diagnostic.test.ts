import {beforeAll,expect,it} from 'vitest';
import {fullAudit} from '../../tools/eval/training-engine-audit';
import {SAMPLE_SIZE,sampledProfiles,extremeProfiles,TRAINING_ENGINE_SEED} from '../../tools/eval/training-engine-profiles';

import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {digest,sourceFingerprint,validEvidence,type Evidence} from '../../tools/training-engine/evidence';
let report:Awaited<ReturnType<typeof fullAudit>>;
beforeAll(async()=>{
 const sourceHash=await sourceFingerprint(),inputHash=digest({profiles:sampledProfiles(),extremes:extremeProfiles()});
 let evidence:Evidence|undefined;
 try{evidence=JSON.parse(await readFile('.cache/engine-full-evidence.json','utf8'));}catch{}
 if(!evidence||!validEvidence(evidence,sourceHash,inputHash,TRAINING_ENGINE_SEED)){
  execFileSync(process.execPath,['tools/training-engine/fast.mjs','--full'],{stdio:'inherit',timeout:300000});
  evidence=JSON.parse(await readFile('.cache/engine-full-evidence.json','utf8'));
 }
 expect(validEvidence(evidence!,await sourceFingerprint(),inputHash,TRAINING_ENGINE_SEED)).toBe(true);
 report=evidence!.report;
},300000);
it('diagnoses 2000 explicit seeded profiles without treating blocked or limited plans as quality passes',()=>{
 expect(report.evaluated).toBe(SAMPLE_SIZE);
 expect(report.extremeEvaluated).toBe(200);
 expect(Object.values(report.weightedTotals).reduce((sum,count)=>sum+count,0)).toBe(SAMPLE_SIZE);
 expect(Object.values(report.extremeTotals).reduce((sum,count)=>sum+count,0)).toBe(200);
 expect(report.actionableHardViolations).toEqual([]);
 for(const issue of report.unsafe)expect(report.environmentUnmet.some(claim=>claim.index===issue.index&&claim.ruleId===issue.ruleId&&claim.issueCodes.includes(issue.reason))).toBe(true);
 expect(report.nondeterministic).toEqual([]);
 // This is the diagnostic contract. The separate quality gate below must also pass for delivery.
},120000);

it('meets all requested quality gates for every eligible plan while reporting health blocks separately',()=>{
 expect(report.totals.fail).toBe(0);
 expect(report.empty).toBe(0);
 expect(report.environmentLimited.withinWeightedLimit).toBe(true);
 expect(report.scoreUnmeasured).toBe(0);
 expect(report.qualityMedian).toBeGreaterThanOrEqual(.75);
 expect(report.qualityP10).toBeGreaterThanOrEqual(.55);
 expect(report.within10Rate).not.toBeNull(); // Retain the original denominator in the report.
 expect(report.timingBreakdown.nonShortWithin10Rate).toBeGreaterThanOrEqual(.90);
 expect(report.timingBreakdown.shortageFraction).toBeLessThanOrEqual(.05);
 expect(report.timingBreakdown.below50Count).toBe(0);
 expect(report.coverageRate).toBeGreaterThanOrEqual(.95);
 expect(report.noticeOverflow).toBe(0);
 expect(report.hardCoverageComplete).toBe(true);
},120000);
