import { describe, expect, it } from 'vitest';
import { expandSchedule } from '../../src/domain/calendar';
import type { PlanVersion } from '../../src/domain/models';
const id = '00000000-0000-4000-8000-000000000001';
function version(weeks = 1): PlanVersion { return { id, planId:id, createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-01T00:00:00Z', revision:0, versionNumber:1,startDate:"2026-10-07",scheduleTimeZone:"Asia/Shanghai", goalSnapshot:{goal:''}, durationWeeks:weeks, daysPerWeek:3, days:Array.from({length:weeks},(_,w)=>[1,3,5].map(dayOfWeek=>({dayId:crypto.randomUUID(),weekIndex:w+1,dayOfWeek,exercises:[{exerciseId:'d16325d9-fc00-4c41-88a1-000000000003' as const,order:0,targetSets:[{metricType:'reps' as const,reps:10}]}]}))).flat() }; }
describe('local calendar',()=>{
 it('starts Wednesday and orders Wednesday, Friday, following Monday',()=>{expect(expandSchedule(version(),'2026-10-07','Asia/Shanghai').map(x=>x.originalDate)).toEqual(['2026-10-07','2026-10-09','2026-10-12']);});
 it('expands twelve consecutive weeks without DST date loss',()=>{const a=expandSchedule(version(12),'2026-03-04','America/New_York'); expect(a).toHaveLength(36); expect(a.map(x=>x.originalDate)).toEqual(expandSchedule(version(12),'2026-03-04','Asia/Shanghai').map(x=>x.originalDate)); expect(a.at(-1)?.originalDate).toBe('2026-05-25');});
 it('rejects impossible dates and time zones',()=>{expect(()=>expandSchedule(version(),'2026-02-30','Asia/Shanghai')).toThrow();expect(()=>expandSchedule(version(),'2026-03-04','invalid')).toThrow();});
 it('rejects weekday count mismatch and duplicate weekdays',()=>{const v=version();v.days.pop();expect(()=>expandSchedule(v,'2026-10-07','Asia/Shanghai')).toThrow();const d=version();d.days[1].dayOfWeek=1;expect(()=>expandSchedule(d,'2026-10-07','Asia/Shanghai')).toThrow();});
});
