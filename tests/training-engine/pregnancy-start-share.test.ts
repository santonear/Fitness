import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {verifyObservedGoalShares} from './v2-quality-observation';
import {legacySampledProfile} from './v1-inputs';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';

import {externalIssues} from '../../tools/eval/training-engine-invariants';
import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';
import {Rules} from '../../src/engine/data';
it('retains the original pregnancy input safety while observing its actual start-moving share targets',()=>{
 const frozen=legacySampledProfile(10),p=baseProfile({...frozen,screening:{...frozen.screening,cmrSymptoms:baseProfile().screening.cmrSymptoms}}),before=structuredClone(p),r=new Rules(),plan=generatePlan(p);
 expect(p.population.kind).toBe('pregnant');expect(p.goal).toBe('start_moving');
 expect(plan.quality?.issues).toEqual([]);expect(plan.gates.some(g=>g.status==='blocked')).toBe(false);expect(validatePlan(plan,p).filter(i=>i.severity==='error')).toEqual([]);
 expect(externalIssues(plan,p)).toEqual([]);expect(plan.templates).toHaveLength(p.daysPerWeek);
 verifyObservedGoalShares(plan,p,r);
 for(const t of plan.templates)for(const i of t.items){const e=r.byExercise.get(i.exerciseId)!;expect(e.position).not.toContain('supine');expect(e.position).not.toContain('prone');}
 expect(p).toEqual(before);
});
