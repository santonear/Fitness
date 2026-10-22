import { derivePainFollowup } from './pain-followup';
import type { Repository } from '../persistence/repository';
import type { WorkoutRecord } from '../domain/v8/contracts';
import { DomainError } from '../domain/errors';
import {
  trainingCheckinInputSchema,
  type TrainingCheckinInput,
  type TrainingCheckinRow,
} from '../domain/training-checkin';
import { DAY_MS } from '../domain/local-date';
export {
  trainingCheckinInputSchema,
  type TrainingCheckinInput,
  type TrainingCheckinRow,
} from '../domain/training-checkin';
import { engineCheckinSchema, type EngineCheckin } from '../engine/contracts';
import { DATA } from '../engine/data';
import { z } from 'zod';
import { painQuestionKeys } from './pain-events';
import type { PlannedItem } from '../domain/v8/contracts';

const retentionDays = DATA.rules.find(rule => rule.id === 'deload.checkin.inputs')!.value!.retain_days;
export function createTrainingCheckin(repo: Repository) {
  async function prune() {
    const now = new Date().toISOString();
    await repo.db.trainingCheckins.where('expiresAt').belowOrEqual(now).delete();
  }
  async function save(answers: TrainingCheckinInput, expectedRevision?: number) {
    const { jointPain, painFollowup, ...parsed } = trainingCheckinInputSchema.parse(answers);
    return repo.write(async () => {
      await prune();
      if (!Object.values(parsed).some(value => value !== undefined)) {
        await repo.db.trainingCheckins.delete('pending');
        return;
      }
      const state = await repo.db.v8State.get('v8');
      if (!state?.coachProfile?.healthStorageConsent?.acceptedAt)
        throw new DomainError('INVALID', 'HEALTH_STORAGE_CONSENT_REQUIRED');
      const validKeys = painQuestionKeys(
        jointPain?.painArea ? [jointPain.painArea] : ['knee', 'back', 'shoulder', 'wrist', 'other'],
      );
      if (Object.keys(jointPain?.redFlagAnswers ?? {}).some(key => !validKeys.includes(key)))
        throw new DomainError('INVALID', 'RED_FLAG_ANSWERS_REQUIRED');
      const now = new Date(),
        followup = derivePainFollowup({ ...parsed, painFollowup }, await repo.db.v8Workouts.toArray());
      const followupKeys = followup ? painQuestionKeys(painFollowup?.painArea ? [painFollowup.painArea] : []) : [];
      if (
        followup &&
        !followupKeys.some(key => jointPain?.redFlagAnswers?.[key] === true) &&
        !followupKeys.every(key => typeof jointPain?.redFlagAnswers?.[key] === 'boolean')
      )
        throw new DomainError('INVALID', 'RED_FLAG_ANSWERS_REQUIRED');
      if (
        followup &&
        !state.painFollowupRestrictions?.some(
          row => row.sourceWorkoutId === followup.sourceWorkoutId && row.pattern === followup.pattern,
        )
      )
        await repo.db.v8State.put({
          ...state,
          ...(painFollowup?.painArea &&
          painFollowup.painArea !== 'other' &&
          state.coachProfile.cautions.includes(painFollowup.painArea)
            ? {
                cautionLevels: {
                  ...state.cautionLevels,
                  [painFollowup.painArea]: { level: 2 as const, changedAt: now.toISOString() },
                },
              }
            : {}),
          painFollowupRestrictions: [
            ...(state.painFollowupRestrictions ?? []),
            { ...followup, appliedAt: now.toISOString() },
          ],
        });
      if (
        (parsed.newOrWorseJointPain || followup) &&
        Object.values(jointPain?.redFlagAnswers ?? {}).some(answer => answer === true)
      )
        await repo.db.v8State.put({
          ...((await repo.db.v8State.get('v8')) ?? state),
          trainingPause: state.trainingPause ?? { requiredAt: now.toISOString() },
        });
      await repo.db.trainingCheckins.put({
        id: 'pending',
        recordedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + retentionDays * DAY_MS).toISOString(),
        answers: parsed,
        ...(painFollowup ? { painFollowup } : {}),
        ...((parsed.newOrWorseJointPain || followup) && jointPain ? { jointPain } : {}),
      });
    }, expectedRevision);
  }
  async function context(history: WorkoutRecord[]) {
    // Reads filter expired rows even if cleanup has not run yet; no expired answer affects a plan.
    const now = new Date().toISOString(),
      table = repo.db.trainingCheckins;
    if (!table) return { history: history.map(({ checkin: _old, ...facts }) => facts), checkin: undefined };
    await prune();
    const rows = (await table.toArray()).filter(row => row.expiresAt > now);
    const consent = (await repo.db.v8State.get('v8'))?.coachProfile?.healthStorageConsent?.acceptedAt;
    if (!consent) return { history: history.map(({ checkin: _old, ...facts }) => facts), checkin: undefined };
    const byId = new Map(rows.map(row => [row.id, row.answers]));
    return {
      history: history.map(({ checkin: legacy, ...facts }) => {
        const legacyExpiry = Date.parse(facts.startedAt) + retentionDays * DAY_MS;
        const answers = byId.get(facts.id) ?? (legacyExpiry > Date.parse(now) ? legacy : undefined);
        return { ...facts, ...(answers ? { checkin: answers } : {}) };
      }),
      checkin: byId.get('pending'),
    };
  }
  async function consume(workoutId: string) {
    if (!repo.db.trainingCheckins) return;
    if (!(await repo.db.v8State.get('v8'))?.coachProfile?.healthStorageConsent?.acceptedAt) {
      await repo.db.trainingCheckins.clear();
      return;
    }
    await prune();
    const row = await repo.db.trainingCheckins.get('pending');
    if (row) {
      await repo.db.trainingCheckins.put({ ...row, id: workoutId });
      await repo.db.trainingCheckins.delete('pending');
    }
  }
  async function assertSafeItems(items: Pick<PlannedItem, 'exerciseId'>[], id = 'pending') {
    if (!repo.db.trainingCheckins) return;
    const row = await repo.db.trainingCheckins.get(id);
    if (!row || row.expiresAt <= new Date().toISOString() || !row.answers.newOrWorseJointPain) return;
    const pain = row.jointPain,
      keys = painQuestionKeys(pain?.painArea ? [pain.painArea] : []);
    if (
      pain?.painScore === undefined ||
      !pain.painArea ||
      !keys.length ||
      !keys.every(key => typeof pain.redFlagAnswers?.[key] === 'boolean')
    )
      throw new DomainError('INVALID', 'RED_FLAG_ANSWERS_REQUIRED');
    if (keys.some(key => pain.redFlagAnswers?.[key] === true)) throw new DomainError('INVALID', 'PAIN_REVIEW_REQUIRED');
    const threshold = DATA.rules.find(rule => rule.id === 'pain.rule')!.value!.bands[1].when.all[0].gte;
    if (
      pain.painScore >= threshold &&
      items.some(item => {
        const e = DATA.exercises.find(e => e.id === item.exerciseId);
        return (
          !e ||
          (pain.painArea === 'other'
            ? Object.values(e.joint_load).some(load => load > 0)
            : (e.joint_load[pain.painArea!] ?? 0) > 0)
        );
      })
    )
      throw new DomainError('INVALID', 'PAIN_REVIEW_REQUIRED');
  }
  return {
    save,
    context,
    consume,
    assertSafeItems,
    pending: async () => {
      const checkin = (await context([])).checkin,
        row = await repo.db.trainingCheckins?.get('pending');
      return checkin
        ? {
            ...checkin,
            ...(row?.painFollowup ? { painFollowup: row.painFollowup } : {}),
            ...(row?.jointPain ? { jointPain: row.jointPain } : {}),
          }
        : undefined;
    },
  };
}
