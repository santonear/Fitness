import {describe,expect,it} from 'vitest';
import report from '../../src/engine/generated/coverage.json';
import index from '../../src/engine/generated/exercise-index.json';
import contract from '../../data/training-engine/coverage-contract.json';
import rules from '../../src/engine/generated/rules-runtime.json';

describe('approved carry-or-ground coverage without rewriting raw carry',()=>{
 it('retains every raw shortage while passing only the specifically approved equivalence',()=>{
  expect(contract.carryEquivalentAuthorized).toBe(true);expect(contract.carryEquivalentPatterns).toEqual(['carry','locomotion_ground']);
  expect(rules.rules.find(row=>row.id===contract.carryEquivalentSourceRuleId)?.value).toMatchObject({patterns:contract.carryEquivalentPatterns});
  expect(report.rawFailures.filter(row=>row.pattern==='carry')).toHaveLength(16);expect(report.rawFailures.filter(row=>row.pattern==='carry').every(row=>row.count===0)).toBe(true);
  expect(report.rawFailures.filter(row=>row.pattern!=='carry')).toEqual(contract.scenarios.map(s=>({scenario:s.id,pattern:'balance',restriction:'pregnancy',count:0})));
  expect(report.environmentLimited).toHaveLength(3);expect(report.environmentLimited.every(row=>row.pattern==='balance'&&row.restriction==='pregnancy'&&row.count===0)).toBe(true);
  expect(report.supportControls).toHaveLength(6);for(const cell of report.supportControls){expect(cell.count).toBeGreaterThanOrEqual(contract.minimumPerCell);expect(['wall','chair']).toContain(cell.support);}
  expect(report.failures).toEqual([]);
  for(const scenario of report.reports)for(const row of scenario.rows)for(const restriction of contract.restrictions){
   const key=restriction as keyof typeof row.counts;
   if(row.pattern==='carry')expect(row.gateCounts[key]).toBeGreaterThanOrEqual(contract.minimumPerCell);
   else expect(row.gateCounts[key]).toBe(row.counts[key]);
  }
 });
 it('adds real wrist-unloaded ground locomotion with explicit knee and floor requirements',()=>{
  const exercise=index.exercises.find(row=>row.slug==='custom-kneeling-forearm-crawl');
  expect(exercise).toMatchObject({primary_pattern:'locomotion_ground',equipment_required:['none'],difficulty:2,joint_load:{wrist:0,knee:1},requires_floor_transition:true});
  expect(exercise?.position).toContain('kneeling');expect(exercise?.flags).toContain('kneeling_on_knee');
  expect(exercise?.primaryMuscles).toEqual(['rectus-abdominis']);
  for(const scenario of report.reports.filter(row=>['bodyweight','bands'].includes(row.scenario.id))){
   const carry=scenario.rows.find(row=>row.pattern==='carry')!;expect(carry.counts.wrist).toBe(0);expect(carry.gateCounts.wrist).toBeGreaterThanOrEqual(2);
  }
 });
});
