import {sourceCandidateFixture} from './source-candidate-fixture';
import {expect,it} from 'vitest';
import {generatePlan,getEligibleExercises} from '../../src/engine';
import fixtures from '../../tools/eval/training-engine-golden-inputs.json';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {engineProfileSchema} from '../../src/engine/contracts';
const profile=()=>{const old=engineProfileSchema.parse(fixtures.find(f=>f.id==='all-cautions-no-floor')!.profile);return baseProfile({...old,screening:{...old.screening,cmrSymptoms:baseProfile().screening.cmrSymptoms}});};
it('does not infer an empty mandatory-pattern pool from caution labels alone',()=>{
 const p=profile(),pool=getEligibleExercises(p);
 // The original diagnostic hypothesis was false: low-load vertical presses remain eligible.
 // No source-unavailability exception may be introduced on that hypothesis.
 expect(pool.some(e=>e.primaryPattern==='push_vertical')).toBe(true);
 const plan=sourceCandidateFixture(p);
 expect(plan.templates.length).toBeGreaterThan(0);
 expect(plan.trace.some(t=>t.reason==='required_pattern_candidate_pool_empty')).toBe(false);
});
it('does not invent an empty-candidate certificate when the required patterns remain available',()=>{
 const p=profile();p.cautions=[];p.preferences.cannotDo=[];
 expect(getEligibleExercises(p).some(e=>e.primaryPattern==='push_vertical')).toBe(true);
 const plan=generatePlan(p);expect(plan.templates.length).toBeGreaterThan(0);
 expect(plan.trace.some(t=>t.reason==='required_pattern_candidate_pool_empty')).toBe(false);
});
