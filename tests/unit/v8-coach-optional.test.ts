import { it,expect } from 'vitest';
import { optionalCoachBody,optionalCoachHistory } from '../../src/application/v8-coach-optional';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
it('only confirmed canonical body details can be offered to the coach',()=>{
 const base={id:crypto.randomUUID(),createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:00:00Z',revision:0,locale:'zh' as const,timeZone:'Asia/Shanghai',units:'metric' as const,trainingPreferences:{updatedAt:'2026-10-12T00:00:00Z',heightCm:180}};
 expect(optionalCoachBody(base)).toBeUndefined();
 const bodyDetails={values:{heightCm:170},source:'migrated' as const,updatedAt:base.updatedAt};
 expect(optionalCoachBody({...base,bodyDetails})).toBeUndefined();
 expect(optionalCoachBody({...base,bodyDetails:{...bodyDetails,confirmedAt:base.updatedAt}})).toEqual({heightCm:170});
 expect(optionalCoachBody(undefined)).toBeUndefined();
});
it('history uses recent committed facts only and omits personal notes and body data',()=>{
 const row={id:'one',startedAt:'2026-10-10T08:00:00Z',status:'partial',sets:[],feedback:{note:'private'},body:{weight:80}} as unknown as WorkoutRecord;
 const text=optionalCoachHistory([row,{...row,id:'old',startedAt:'2026-01-01T08:00:00Z'},{...row,id:'active',status:'in_progress'}],'2026-10-10','Asia/Shanghai','en');
 expect(text).toBe('2026-10-10 · partial\n\n');expect(text).not.toContain('private');expect(text).not.toContain('80');
 expect(optionalCoachHistory([],'2026-10-10','Asia/Shanghai','en')).toBeUndefined();
});
