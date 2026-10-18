import {describe,it,expect} from 'vitest';
import {engineProfileSchema,enginePlanSchema} from '../../src/engine/contracts';
import * as engine from '../../src/engine';
const profile={goal:'health',level:'beginner',trainingAgeWeeks:0,daysPerWeek:3,sessionMinutes:30,equipment:['none'],place:'home',constraints:{noJump:true,quiet:true,space:'small'},cautions:[],population:{kind:'general'},screening:{parqAllNo:false,knownCondition:false,symptoms:false},preferences:{excludedExerciseIds:[],cannotDo:[]}} as const;
describe('training engine boundary contract',()=>{
 it('keeps unfinished screening explicit instead of inventing all-no',()=>{const p=engineProfileSchema.parse(profile);expect(p.screening.parqAllNo).toBe(false);expect(p.screening.completedAt).toBeUndefined();expect(p.screening.parqAnswers).toBeUndefined();});
 it('accepts the new input bounds without changing old persisted plan contracts',()=>{for(const sessionMinutes of [10,90])expect(engineProfileSchema.safeParse({...profile,sessionMinutes}).success).toBe(true);for(const sessionMinutes of [9,91])expect(engineProfileSchema.safeParse({...profile,sessionMinutes}).success).toBe(false);expect(engineProfileSchema.safeParse({...profile,daysPerWeek:7}).success).toBe(false);});
 it('provides detached step-zero placeholders, not an activated application path',()=>{const p=engineProfileSchema.parse(profile);expect(enginePlanSchema.parse(engine.generatePlan(p)).templates).toEqual([]);expect(engine.modifyPlan(engine.generatePlan(p),p,[]).noop).toBe(true);});
});
