import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { projectLegacyWorkouts } from '../../src/domain/v8/legacy-workouts';
import { v8WorkoutSchema } from '../../src/domain/schemas';

const fixture = () => validateBackupEnvelope(JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-plans-weight.json', import.meta.url), 'utf8'))).data;
describe('legacy workout read projection', () => {
  it('preserves original associations and never invents per-set completion times or feedback', () => {
    const data = fixture(), before = structuredClone(data);
    const result = projectLegacyWorkouts(data.sessions, data.sets);
    expect(result).toHaveLength(data.sessions.length);
    for (const row of result) {
      expect(row.planVersionId).toBe(data.sessions.find(session => session.id === row.id)?.planVersionId);
      expect(row.feedback).toBeUndefined();
      row.sets.forEach(set => { expect(set.completedAt).toBeUndefined(); expect(set.legacyUpdatedAt).toBeTruthy(); });
    }
    expect(data).toEqual(before);
  });
  it('distinguishes completed, partial, zero-set and ongoing records from actual set evidence', () => {
    const data = fixture();
    const session = data.sessions.find(row => row.status === 'completed')!;
    const snapshot = session.exerciseSnapshots[0];
    const base = data.sets.find(row => row.sessionId === session.id)!;
    const input = { ...session, exerciseSnapshots: [{ ...snapshot, targetSets: [{ metricType: 'reps' as const, reps: 8 }, { metricType: 'reps' as const, reps: 8 }] }] };
    const sets = [0, 1].map(order => ({ ...base, exerciseInstanceId: snapshot.exerciseInstanceId, order, completed: true }));
    expect(projectLegacyWorkouts([input], sets)[0].status).toBe('complete');
    expect(projectLegacyWorkouts([input], sets.slice(0, 1))[0].status).toBe('partial');
    expect(projectLegacyWorkouts([input], [])[0].status).toBe('not_started');
    expect(projectLegacyWorkouts([{ ...input, status: 'in_progress', completedAt: undefined }], [])[0].status).toBe('in_progress');
    expect(projectLegacyWorkouts([{ ...input, status: 'abandoned', completedAt: undefined }], [])[0].status).toBe('abandoned');
  });
  it('retains free training without assigning a plan or treating unknown targets as all completed', () => {
    const data = fixture(), session = data.sessions[0];
    const free = { ...session, status: 'completed' as const, planVersionId: undefined, plannedDayId: undefined,
      exerciseSnapshots: session.exerciseSnapshots.map(item => ({ ...item, targetSets: [] })) };
    const result = projectLegacyWorkouts([free], data.sets)[0];
    expect(result.planVersionId).toBeUndefined();
    expect(result.status).not.toBe('complete');
    expect(result.plannedSetCount).toBe(0);
  });
  it('accepts the approved free-workout shape without a fake plan id', () => {
    const session = fixture().sessions[0];
    const record = { id: session.id, startedAt: session.startedAt, localDate: session.localDate,
      timeZone: session.timeZone, status: 'in_progress', sets: [], plannedSetCount: 0 };
    expect(v8WorkoutSchema.parse(record)).not.toHaveProperty('planVersionId');
  });
});
