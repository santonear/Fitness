import { expect, it } from 'vitest';
import { createBackupService, MAX_BACKUP_BYTES } from '../../src/application/backup';
import type { Repository } from '../../src/persistence/repository';

const stamp = '2026-10-05T00:00:00Z';
const id = '00000000-0000-4000-8000-000000000001';
const envelope = { format: 'fitness-local', schemaVersion: 3, catalogVersion: 1, exportedAt: stamp,
  data: { metadata: { schemaVersion: 4, catalogVersion: 1, localProfileId: id, revision: 1, dataRevision: 1 },
    profiles: [{ id, revision: 0, createdAt: stamp, updatedAt: stamp, locale: 'zh', timeZone: 'UTC', units: 'metric', trainingPreferences: { updatedAt: stamp, goal: '保留完整训练记录' } }],
    plans: [], planVersions: [], sessions: [], sets: [], scheduledWorkouts: [], bodyWeights: [], timers: [], aiMemoryNotes: [], mediaAssets: [],
    trainingMemo: { schemaVersion: 1, revision: 0, sourceRevision: 1, updatedAt: stamp, sessions: [] } } };

it('supports the measured 16 MiB candidate and exact UTF8 boundaries without weakening structure checks', async () => {
  expect(MAX_BACKUP_BYTES).toBe(16_777_216);
  const text = JSON.stringify(envelope); const size = new Blob([text]).size;
  expect(size).toBeGreaterThan(text.length);
  const service = createBackupService({ readMetadata: async () => ({ dataRevision: 7 }) } as Repository);
  for (const bytes of [MAX_BACKUP_BYTES - 1, MAX_BACKUP_BYTES]) {
    const file = new File([text, ' '.repeat(bytes - size)], 'boundary.json');
    expect(file.size).toBe(bytes);
    await expect(service.validateBackup(file)).resolves.toMatchObject({ expectedRevision: 7 });
  }
  await expect(service.validateBackup(new File([text, ' '.repeat(MAX_BACKUP_BYTES + 1 - size)], 'too-large.json'))).rejects.toMatchObject({ code: 'BACKUP_TOO_LARGE' });
  await expect(service.validateBackup(new File(['{"format":"unknown"}'], 'bad.json'))).rejects.toMatchObject({ code: 'BACKUP_INVALID' });
});
