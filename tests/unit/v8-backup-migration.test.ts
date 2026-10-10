import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { prepareV8Migration } from '../../src/persistence/v8-migration';
import { scheduledWorkoutSchema } from '../../src/domain/schemas';
import { legacyTrainingSeconds } from '../../src/domain/v8/legacy-selection';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/legacy-backups/${name}.json`, import.meta.url), 'utf8'));
const at = '2026-10-10T00:00:00.000Z';
describe('V8 backup migration boundary', () => {
  for (const name of ['v5-onboarding', 'v62-onboarding', 'v71-onboarding', 'v5-plans-weight', 'v62-plans-weight', 'v71-plans-weight', 'v71-coach-plan', 'v5-onboarding-restored', 'v62-onboarding-restored', 'v71-onboarding-restored']) {
    it(`validates migrated real UI backup ${name}`, async () => {
      const source = validateBackupEnvelope(read(name));
      const before = structuredClone(source);
      const v8 = await prepareV8Migration(source.data, at);
      const migrated = { ...source, schemaVersion: 6, data: { ...source.data, metadata: { ...source.data.metadata, schemaVersion: 8 }, v8 } };
      expect(validateBackupEnvelope(migrated).data.v8).toEqual(v8);
      expect(source).toEqual(before);
      expect(await prepareV8Migration(source.data, at)).toEqual(v8);
    });
  }
  it('accepts only historical duration anomalies, retaining raw values and estimating usable templates', async () => {
    for (const raw of [undefined, 0, 'invalid', null, {}, 14, 121, 14.5, 120.4]) {
      const original = read('v71-coach-plan');
      original.data.scheduledWorkouts[0].durationMinutes = raw;
      const parsed = validateBackupEnvelope(original);
      const v8 = await prepareV8Migration(parsed.data, at);
      expect(parsed.data.scheduledWorkouts[0].durationMinutes).toEqual(raw);
      expect(v8.planVersions[0].templates[0].estimatedMinutes).toBeGreaterThanOrEqual(15);
      expect(v8.planVersions[0].templates[0].estimatedMinutes).toBeLessThanOrEqual(120);
      expect(Number.isInteger(v8.planVersions[0].templates[0].estimatedMinutes)).toBe(true);
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw === 0) expect(scheduledWorkoutSchema.safeParse(original.data.scheduledWorkouts[0]).success).toBe(false);
    }
  });
  it('still rejects invalid legacy references and unrelated malformed fields', () => {
    const original = read('v71-coach-plan');
    original.data.scheduledWorkouts[0].durationMinutes = 'historical';
    original.data.scheduledWorkouts[0].planVersionId = crypto.randomUUID();
    expect(() => validateBackupEnvelope(original)).toThrow();
    original.data.scheduledWorkouts[0].planVersionId = original.data.planVersions[0].id;
    original.data.scheduledWorkouts[0].startTime = 'impossible';
    expect(() => validateBackupEnvelope(original)).toThrow();
  });
  it('retains negative and over-12-hour historical timestamps across backup validation', () => {
    for (const elapsed of [-1000, 12 * 60 * 60 * 1000 + 1000]) {
      const original = read('v71-plans-weight');
      const session = original.data.sessions[0];
      session.completedAt = new Date(Date.parse(session.startedAt) + elapsed).toISOString();
      const parsed = validateBackupEnvelope(original);
      expect(parsed.data.sessions[0]).toEqual(session);
      expect(legacyTrainingSeconds(parsed.data.sessions[0])).toBeUndefined();
    }
  });
  it('rejects V8 references that could misattribute history', async () => {
    const source = validateBackupEnvelope(read('v71-coach-plan'));
    const v8 = await prepareV8Migration(source.data, at);
    v8.plans[0].currentVersionId = crypto.randomUUID();
    expect(() => validateBackupEnvelope({ ...source, schemaVersion: 6, data: { ...source.data, metadata: { ...source.data.metadata, schemaVersion: 8 }, v8 } })).toThrow();
  });
  it('retains a today-only override and rejects orphan targets',async()=>{
    const source=validateBackupEnvelope(read('v71-coach-plan')),v8=await prepareV8Migration(source.data,at);
    const plan=v8.plans.find(p=>p.id===v8.state.currentPlanId)!,version=v8.planVersions.find(v=>v.id===plan.currentVersionId)!;
    v8.state.nextWorkoutOverride={planVersionId:version.id,templateId:version.templates[0].id,template:structuredClone(version.templates[0]),requestId:crypto.randomUUID()};
    const envelope={...source,schemaVersion:6,data:{...source.data,metadata:{...source.data.metadata,schemaVersion:8},v8}};
    expect(validateBackupEnvelope(envelope).data.v8?.state.nextWorkoutOverride).toEqual(v8.state.nextWorkoutOverride);
    v8.state.nextWorkoutOverride.planVersionId=crypto.randomUUID();expect(()=>validateBackupEnvelope(envelope)).toThrow();
  });
  it('backs up free training but refuses an unattached template or unknown plan', async () => {
    const source = validateBackupEnvelope(read('v71-coach-plan'));
    const v8 = await prepareV8Migration(source.data, at);
    v8.workouts.push({ id: crypto.randomUUID(), startedAt: at, localDate: '2026-10-10', timeZone: 'UTC', status: 'not_started', sets: [], plannedSetCount: 0 });
    const envelope = { ...source, schemaVersion: 6, data: { ...source.data, metadata: { ...source.data.metadata, schemaVersion: 8 }, v8 } };
    expect(validateBackupEnvelope(envelope).data.v8?.workouts[0].planVersionId).toBeUndefined();
    v8.workouts[0].templateId = 'orphan';
    expect(() => validateBackupEnvelope(envelope)).toThrow();
    delete v8.workouts[0].templateId;
    v8.workouts[0].planVersionId = crypto.randomUUID();
    expect(() => validateBackupEnvelope(envelope)).toThrow();
  });
});
