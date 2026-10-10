import type { WorkoutRecord, LegacyWorkoutProjection } from '../../domain/v8/contracts';
import type { createV8DataService } from '../../persistence/v8-access';
import { activityDate } from '../v8-activity';
type LegacyHistory = Awaited<ReturnType<ReturnType<typeof createV8DataService>['getLegacyHistory']>>;
export type ReviewHistoryRow = (WorkoutRecord | LegacyWorkoutProjection) & { originalNotes?: string; setNotes?: readonly (string | undefined)[] };
/** Read-only display projection. Native identities win, matching the statistics projection. */
export function reviewHistory(workouts: readonly WorkoutRecord[], legacy: readonly LegacyWorkoutProjection[], original: LegacyHistory): ReviewHistoryRow[] {
 const history:ReviewHistoryRow[]=legacy.map(row=>{
  const raw=original.find(item=>item.session.id===row.id);
  return {...row,originalNotes:raw?.session.notes,setNotes:row.sets.map(set=>raw?.sets.find(s=>s.exerciseInstanceId===raw.session.exerciseSnapshots[set.itemIndex]?.exerciseInstanceId&&s.order===set.setIndex&&s.completed)?.notes)};
 });
 return [...new Map([...history,...workouts].map(row=>[row.id,row])).values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
}
export function historyInPeriod(rows: readonly ReviewHistoryRow[], from:string, to:string, timeZone:string){
 return rows.filter(row=>{
  if(['in_progress','abandoned'].includes(row.status))return false;
  const date=activityDate(timeZone,0,new Date(row.startedAt));
  return date>=from&&date<=to;
 });
}
