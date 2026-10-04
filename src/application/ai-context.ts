import { DomainError } from '../domain/errors';
import type { LocalProfile } from '../domain/models';
import type { Repository } from '../persistence/repository';
import { buildHistoryContext, type HistoryManifest, type HistoryScope, type HistorySnapshot } from './history-context';
export type { HistoryScope, HistoryManifest } from './history-context';
export interface AiContextCapture {
  profile: LocalProfile;
  dataRevision: number;
  restoreGeneration: number;
  history?: { text: string; range: { from: string; to: string }; sourceRevision: number; restoreGeneration: number };
  manifest?: HistoryManifest;
}
/** Caller must already hold a whole-library read or write transaction. Never rebuilds memo. */
export async function readAiSnapshot(repo: Repository): Promise<{profile: LocalProfile; snapshot: HistorySnapshot}> {
  const db=repo.db, metadata=await repo.readMetadata();
  const profile=await db.profiles.get(metadata.localProfileId);
  if (!profile) throw new DomainError('INVALID','Local profile is not initialized');
  const [plans,planVersions,sessions,sets,scheduledWorkouts,bodyWeights]=await Promise.all([db.plans.toArray(),db.planVersions.toArray(),db.sessions.toArray(),db.sets.toArray(),db.scheduledWorkouts.toArray(),db.bodyWeights.toArray()]);
  return {profile:structuredClone(profile),snapshot:{capturedAt:new Date().toISOString(),dataRevision:metadata.dataRevision,restoreGeneration:metadata.restoreGeneration??0,plans,planVersions,sessions,sets,scheduledWorkouts,bodyWeights}};
}
export function createAiContextService(repo: Repository) {
  return {async capture(scope?: HistoryScope): Promise<AiContextCapture> {
    return repo.db.transaction('r',repo.db.tables,async()=>{
      const {profile,snapshot}=await readAiSnapshot(repo);
      const result:AiContextCapture={profile,dataRevision:snapshot.dataRevision,restoreGeneration:snapshot.restoreGeneration};
      if (!scope) return result;
      const built=buildHistoryContext(snapshot,scope);
      if (!built.ok) throw new DomainError('INVALID',built.reason==='over_budget'?`History exceeds byte budget (${built.requiredUtf8Bytes}/${built.maxUtf8Bytes}); revise scope`:built.detail);
      return {...result,history:{text:built.json,range:{from:scope.from,to:scope.to},sourceRevision:snapshot.dataRevision,restoreGeneration:snapshot.restoreGeneration},manifest:built.manifest};
    });
  }};
}
