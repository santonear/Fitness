import type { CoachRequest, CoachResponse } from '../coach/contracts';
import type { AiMemoryNote } from '../domain/models';
import { aiMemoryNoteSchema } from '../domain/schemas';
import { exercises } from '../catalog/exercises';
import { assistantMovement } from '../catalog/ai-catalog';
import { repository } from './repository';

export type AssistantPreference = Pick<AiMemoryNote, 'kind' | 'value'> & {
  kind: NonNullable<AiMemoryNote['kind']>;
  value: NonNullable<AiMemoryNote['value']>;
};
const same = (a: AssistantPreference, b: AssistantPreference) =>
  a.kind === b.kind && JSON.stringify(a.value) === JSON.stringify(b.value);
const proposalOf = (response: CoachResponse) =>
  'proposal' in response
    ? response.proposal
    : response.type === 'review_summary'
      ? response.suggestion?.proposal
      : undefined;

/** A plan acceptance confirms structured changes; chatting alone never creates memory. */
export function confirmedPreferenceChanges(
  request: CoachRequest,
  response: CoachResponse,
  userMessage: string,
): AssistantPreference[] {
  const proposal = proposalOf(response),
    result: AssistantPreference[] = [];
  if (!proposal) return result;
  if (
    request.task === 'MODIFY_PLAN' &&
    JSON.stringify(proposal.templates) === JSON.stringify(request.plan.templates) &&
    JSON.stringify(proposal.preferredDays) === JSON.stringify(request.plan.preferredDays) &&
    proposal.weeklyTarget === request.plan.weeklyTarget &&
    proposal.sessionMinutes === request.plan.sessionMinutes &&
    proposal.goalText === request.plan.goalText
  )
    return result;
  if (
    proposal.preferredDays?.length &&
    (request.task === 'ONBOARD_PLAN' ||
      (request.task === 'MODIFY_PLAN' &&
        JSON.stringify(proposal.preferredDays) !== JSON.stringify(request.plan.preferredDays)))
  )
    result.push({ kind: 'preferred_days', value: proposal.preferredDays });
  if (request.task === 'ONBOARD_PLAN') {
    for (const caution of request.profile.cautions) result.push({ kind: 'caution_area', value: caution });
    for (let index = 0; index < request.profile.equipment.length; index += 7)
      result.push({ kind: 'equipment', value: request.profile.equipment.slice(index, index + 7) });
  }
  if (/(?:不能跳|不跳|避免跳|can't jump|cannot jump|no jumping)/i.test(userMessage))
    result.push({ kind: 'cannot_do', value: 'jumping' });
  const avoidCarry =
    /(?:以后|今后|往后|再也|以后都).{0,18}(?:别|不要|不再|不能|避免).{0,12}(?:农夫行走|负重行走)|(?:don't|do not|never|avoid|no more).{0,25}(?:farmer.?s? walk|farmer.?s? carry|walking carry)/i.test(
      userMessage,
    );
  const carryStillPlanned = proposal.templates.some(template =>
    template.items.some(item => {
      const exercise = exercises.find(entry => entry.id === item.exerciseId);
      return exercise && assistantMovement(exercise) === 'carry';
    }),
  );
  if (avoidCarry && !carryStillPlanned) result.push({ kind: 'cannot_do', value: 'walking_carry' });
  if (
    request.task === 'MODIFY_PLAN' &&
    (avoidCarry ||
      /(?:不会做|不想做|不要做|不再安排|别.{0,8}安排|讨厌|can't do|cannot do|avoid|don't|do not|never)/i.test(
        userMessage,
      ))
  ) {
    const afterIds = new Set(proposal.templates.flatMap(template => template.items.map(item => item.exerciseId)));
    for (const before of request.plan.templates)
      for (const item of before.items) {
        const exercise = exercises.find(entry => entry.id === item.exerciseId);
        if (!exercise || afterIds.has(item.exerciseId)) continue;
        const mentioned = [exercise.name.zh, exercise.name.en].some(
          label => label && userMessage.toLowerCase().includes(label.toLowerCase()),
        );
        if (mentioned || (avoidCarry && assistantMovement(exercise) === 'carry'))
          result.push({ kind: 'dislike_exercise', value: item.exerciseId });
      }
  }
  return result.filter((item, index) => result.findIndex(other => same(item, other)) === index);
}

export const assistantPreferences = {
  async list() {
    return (await repository.db.aiMemoryNotes.toArray())
      .filter((note): note is AiMemoryNote & AssistantPreference => !!note.kind && note.value !== undefined)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async forRequest(): Promise<AssistantPreference[]> {
    return (await this.list()).slice(0, 30).map(({ kind, value }) => ({ kind, value }));
  },
  async save(items: AssistantPreference[], locale: 'zh' | 'en') {
    if (!items.length) return [] as AiMemoryNote[];
    return repository.write(async () => {
      const existing = await repository.db.aiMemoryNotes.toArray(),
        present = existing.filter(
          (note): note is AiMemoryNote & AssistantPreference => !!note.kind && note.value !== undefined,
        ),
        created: AiMemoryNote[] = [];
      for (const item of items) {
        if (
          present.some(note => same(note, item)) ||
          created.some(note => same(note as AiMemoryNote & AssistantPreference, item)) ||
          present.length + created.length >= 30
        )
          continue;
        const now = new Date().toISOString(),
          note = aiMemoryNoteSchema.parse({
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            revision: 0,
            memoRevision: 0,
            generatorVersion: 'assistant-v3.0.0',
            locale,
            suggestion: '',
            explanation: '',
            ...item,
          });
        created.push(note);
      }
      if (created.length) await repository.db.aiMemoryNotes.bulkAdd(created);
      return created;
    });
  },
  async remove(ids: string[]) {
    if (!ids.length) return;
    await repository.write(async () => {
      const notes = await repository.db.aiMemoryNotes.bulkGet(ids);
      if (notes.some(note => !note?.kind)) throw Error('PREFERENCE_NOT_FOUND');
      await repository.db.aiMemoryNotes.bulkDelete(ids);
    });
  },
};
