import {expect,it} from 'vitest';
import {Rules} from '../../src/engine/data';
import {prescribe} from '../../src/engine/dose';
import {safety} from '../../src/engine/gates/strength-scoring';
import {estimatedSeconds,weeklyElapsedAllocation} from '../../src/engine/fit/elapsed-time';
import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';

// Contract arithmetic only: current registered cardio has no per-side source flag.
it.each([false,true])('counts a continuous prescribed side once, without inventing a set or overhead: %s',perSide=>{
 const rules=new Rules(),profile=goldenProfiles[0].profile,exercise=rules.data.exercises.find(e=>e.modality==='cardio'&&e.use.includes('conditioning'))!;
 expect(exercise.time.per_side).toBe(false);
 const item=prescribe(exercise,profile,rules,safety(profile,rules),'conditioning',1);item.target={metricType:'duration',durationSeconds:60};item.prescription!.perSide=perSide;
 const day={id:'contract-clock',name:'contract arithmetic',estimatedMinutes:2,items:[item]},seconds=perSide?120:60;
 expect(estimatedSeconds(day,rules)).toBe(seconds);
 expect(weeklyElapsedAllocation([day],rules)).toMatchObject({aerobic:seconds,total:seconds});
 expect(independentElapsedAllocation({templates:[day]})).toMatchObject({aerobic:seconds,total:seconds});
 expect(item.sets).toBe(1);
});
