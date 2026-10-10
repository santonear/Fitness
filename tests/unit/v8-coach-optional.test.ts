import { it,expect } from 'vitest';
import { optionalCoachBody,optionalCoachHistory } from '../../src/application/v8-coach-optional';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
it('keeps skipped body fields unknown and rejects invalid answers',()=>{
 expect(optionalCoachBody(undefined,{heightCm:{status:'answered',value:170},weightKg:{status:'skipped'},age:{status:'answered',value:999}})).toEqual({heightCm:170});
 expect(optionalCoachBody(undefined)).toBeUndefined();
});
it('history uses recent committed facts only and omits personal notes and body data',()=>{
 const row={id:'one',startedAt:'2026-10-10T08:00:00Z',status:'partial',sets:[],feedback:{note:'private'},body:{weight:80}} as unknown as WorkoutRecord;
 const text=optionalCoachHistory([row,{...row,id:'old',startedAt:'2026-01-01T08:00:00Z'},{...row,id:'active',status:'in_progress'}],'2026-10-10','Asia/Shanghai','en');
 expect(text).toBe('2026-10-10 · partial\n\n');expect(text).not.toContain('private');expect(text).not.toContain('80');
 expect(optionalCoachHistory([],'2026-10-10','Asia/Shanghai','en')).toBeUndefined();
});
