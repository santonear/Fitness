import {it,expect} from 'vitest';
import {currentWorkoutContext} from '../../src/assistant/client-context';
import type {FitnessDatabase} from '../../src/persistence/db';
import type {CoachRequest} from '../../src/coach/contracts';
it('shares only matching active workout metrics, without notes or historical timestamps',async()=>{
 const request={task:'ADJUST_TODAY',workoutId:'active',target:{versionId:'version'},template:{id:'template'}} as CoachRequest;
 const row={status:'in_progress',planVersionId:'version',templateId:'template',plannedSetCount:5,feedback:{note:'PRIVATE'},sets:[{exerciseId:'exercise',itemIndex:0,setIndex:0,reps:8,loadGrams:null,completedAt:'PRIVATE',substitutedFrom:'PRIVATE'}]};
 const db={v8Workouts:{get:async()=>row}} as unknown as FitnessDatabase;
 expect(await currentWorkoutContext(request,db)).toEqual({completedSets:[{exerciseId:'exercise',itemIndex:0,setIndex:0,reps:8}],remainingSets:4});
 row.status='complete';expect(await currentWorkoutContext(request,db)).toBeUndefined();row.status='in_progress';row.planVersionId='other';expect(await currentWorkoutContext(request,db)).toBeUndefined();expect(await currentWorkoutContext(undefined,db)).toBeUndefined();
});
