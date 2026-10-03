import { DomainError } from '../domain/errors';
import type { BodyWeightInput, BodyWeightObservation } from '../domain/models';
import { bodyWeightObservationSchema } from '../domain/schemas';
import { repository, type Repository } from '../persistence/repository';
export function createBodyWeightService(repo: Repository) {
  async function listBodyWeights(): Promise<BodyWeightObservation[]> { return repo.db.bodyWeights.orderBy('localDate').reverse().toArray(); }
  async function saveBodyWeight(input: BodyWeightInput, expectedRevision?: number): Promise<BodyWeightObservation> {
    return repo.write(async () => {
      const existing = input.id ? await repo.db.bodyWeights.get(input.id) : undefined;
      if (input.id && (!existing || existing.revision !== expectedRevision)) throw new DomainError('CONFLICT', 'Observation changed; reload before editing');
      const sameDate = await repo.db.bodyWeights.where('localDate').equals(input.localDate).first();
      if (sameDate && sameDate.id !== input.id) throw new DomainError('CONFLICT', 'This date already has an observation. Choose Edit.');
      const timestamp = new Date().toISOString();
      const parsed = bodyWeightObservationSchema.safeParse({ ...input, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp, revision: existing ? existing.revision + 1 : 0 });
      if (!parsed.success) throw new DomainError('INVALID', parsed.error.message);
      await repo.db.bodyWeights.put(parsed.data);
      return parsed.data;
    });
  }
  async function deleteBodyWeight(id: string, expectedRevision: number): Promise<void> {
    await repo.write(async () => {
      const existing = await repo.db.bodyWeights.get(id);
      if (!existing || existing.revision !== expectedRevision) throw new DomainError('CONFLICT', 'Observation changed; reload before deleting');
      await repo.db.bodyWeights.delete(id);
    });
  }
  return { listBodyWeights, saveBodyWeight, deleteBodyWeight };
}
export const bodyWeightService = createBodyWeightService(repository);
export const saveBodyWeight = bodyWeightService.saveBodyWeight;
export const deleteBodyWeight = bodyWeightService.deleteBodyWeight;
