import {expect,it} from 'vitest';
import {qualityMetrics} from '../../tools/eval/training-engine-audit';
import {Rules} from '../../src/engine/data';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {planFixture} from '../unit/engine/fixtures';
const rules=new Rules();
it('leaves coverage inapplicable when postpartum phase one permits no required strength pattern',()=>{const profile=baseProfile({population:{kind:'postpartum',weeksSinceBirth:1,delivery:'cesarean',cleared:false}}),metrics=qualityMetrics(planFixture(),profile);expect(metrics.coverageApplicable).toBe(false);expect(metrics.coverage).toBe(false);});
function singleGroup(){const squat=rules.data.exercises.find(e=>e.slug==='bodyweight-squat')!,walking=rules.data.exercises.find(e=>e.slug==='walking')!,profile=baseProfile({constraints:{noJump:false,quiet:false,space:'large'},preferences:{cannotDo:[],excludedExerciseIds:rules.data.exercises.filter(e=>![squat.id,walking.id].includes(e.id)).map(e=>e.id)}});return {profile,squat,plan:planFixture()};}
it('keeps a legal but uncovered sole required pattern group as an applicable miss',()=>{const {plan,profile}=singleGroup();expect(qualityMetrics(plan,profile)).toMatchObject({coverageApplicable:true,coverage:false});});
it('counts the same sole required group only when its actual primary pattern is present',()=>{const {plan,profile,squat}=singleGroup();plan.templates[0].items.push({exerciseId:squat.id,equipment:'none',sets:2,target:{metricType:'reps',reps:12},prescription:{pattern:squat.primary_pattern,block:'main',rir:[3,3],restSeconds:60,structure:'straight'}});expect(qualityMetrics(plan,profile)).toMatchObject({coverageApplicable:true,coverage:true});});
