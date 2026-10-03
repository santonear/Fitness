import { expect, it } from 'vitest';
import { createBackupService } from '../../src/application/backup';
import type { Repository } from '../../src/persistence/repository';

it('reports an unreadable file separately from invalid JSON syntax', async () => {
  const file = new File(['{}'], 'unreadable.json');
  file.text = async () => { throw new DOMException('I/O read failed', 'NotReadableError'); };
  const backup = createBackupService({} as Repository);
  await expect(backup.validateBackup(file)).rejects.toMatchObject({ code: 'BACKUP_INVALID', message: expect.stringContaining('read') });
});
