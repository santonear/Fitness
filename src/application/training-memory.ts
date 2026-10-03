import { repository, type Repository } from '../persistence/repository';
import type { TrainingMemo, WorkoutSession } from '../domain/models';

// Within the facts transaction, replace only the changed session.
export async function synchronizeTrainingMemo(repo: Repository, changed?: WorkoutSession): Promise<TrainingMemo> {
 const previous=await repo.db.trainingMemo.get(1);
 const sessions=changed && previous ? [changed] : await repo.db.sessions.toArray();
 const entries=await Promise.all(sessions.map(async session=>({session,sets:await repo.db.sets.where('sessionId').equals(session.id).sortBy('order'),...(session.planVersionId?{planVersionSnapshot:await repo.db.planVersions.get(session.planVersionId)}:{})})));
 const memo:TrainingMemo={schemaVersion:1,revision:(previous?.revision??0)+1,updatedAt:new Date().toISOString(),sourceRevision:(await repo.readMetadata()).dataRevision+1,sessions:changed && previous ? [...previous.sessions.filter(entry=>entry.session.id!==changed.id),...entries] : entries};
 await repo.db.trainingMemo.put(memo);return memo;
}
export function createTrainingMemoryService(repo:Repository) {
 async function rebuildTrainingMemo(){return repo.write(()=>synchronizeTrainingMemo(repo));}
 async function readTrainingMemo(){return await repo.db.trainingMemo.get(1)??await rebuildTrainingMemo();}
 return {readTrainingMemo,rebuildTrainingMemo};
}
export const trainingMemoryService=createTrainingMemoryService(repository);
export const {readTrainingMemo,rebuildTrainingMemo}=trainingMemoryService;
