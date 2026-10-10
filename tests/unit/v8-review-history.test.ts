import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { projectLegacyWorkouts } from '../../src/domain/v8/legacy-workouts';
import { reviewHistory, historyInPeriod } from '../../src/application/review/history';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
const fixture=()=>validateBackupEnvelope(JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-plans-weight.json',import.meta.url),'utf8'))).data;
describe('review history read projection',()=>{
 it('includes legacy training, original notes and full metrics without altering stored facts',()=>{
  const data=fixture(),session=data.sessions.find(s=>s.status==='completed')!;session.notes='original session note';const set=data.sets.find(s=>s.sessionId===session.id&&s.completed)!;set.notes='original set note';
  const before=structuredClone(data),projections=projectLegacyWorkouts(data.sessions,data.sets),raw=data.sessions.map(session=>({session,sets:data.sets.filter(s=>s.sessionId===session.id),trainingSeconds:0}));
  const rows=reviewHistory([],projections,raw),row=rows.find(r=>r.id===session.id)!;
  expect(row.originalNotes).toBe('original session note');expect(row.setNotes).toContain('original set note');expect(row.sets).toEqual(projections.find(r=>r.id===session.id)!.sets);expect(data).toEqual(before);
 });
 it('deduplicates using native facts and chooses periods by the review timezone',()=>{
  const data=fixture(),legacy=projectLegacyWorkouts(data.sessions,data.sets)[0];
  const native:WorkoutRecord={id:legacy.id,startedAt:'2026-10-10T23:00:00Z',localDate:'2026-10-10',timeZone:'UTC',status:'partial',plannedSetCount:1,sets:[],appendedNotes:[{text:'later note',createdAt:'2026-10-11T00:00:00Z'}]};
  const rows=reviewHistory([native],[legacy],[]);expect(rows).toHaveLength(1);expect(rows[0]).toEqual(native);
  expect(historyInPeriod(rows,'2026-10-11','2026-10-11','Asia/Shanghai')).toHaveLength(1);expect(historyInPeriod(rows,'2026-10-10','2026-10-10','Asia/Shanghai')).toEqual([]);
  expect(historyInPeriod([{...native,status:'abandoned'},{...native,status:'in_progress'}],'2026-10-10','2026-10-12','UTC')).toEqual([]);
 });
});
