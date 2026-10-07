import type { Repository } from '../persistence/repository';
import { readAiSnapshot } from './ai-context';
import { buildHistoryContext } from './history-context';
import { DomainError } from '../domain/errors';

/** Read-only, bounded reuse of the established history contract. Runtime capture
 * metadata is excluded from equality so an unchanged scope remains confirmable. */
export async function captureGuidedHistory(repo: Repository, from: string, to: string, maxUtf8Bytes: number) {
  return repo.db.transaction('r', repo.db.tables, async () => {
    const { snapshot } = await readAiSnapshot(repo);
    const result = buildHistoryContext(snapshot, { from, to, sources: ['sessions', 'bodyWeights'], maxUtf8Bytes });
    if (!result.ok) throw new DomainError('INVALID', result.reason === 'over_budget'
      ? 'Selected history exceeds the request limit; narrow the range or continue without history'
      : result.detail);
    const { capturedAt: _time, dataRevision: _revision, ...content } = result.payload;
    return JSON.stringify(content);
  });
}
