import { z } from "zod";
import type {
  PlannedItem,
  SessionTemplate,
  WorkoutRecord,
} from "../../domain/v8/contracts";
import {
  nonnegative,
  type Pattern,
  type Caution,
  type EngineProfile,
} from "./profile";
import {
  bilingualSchema,
  type RuleTrace,
  type EngineNotice,
  type GateResult,
  type EnginePlan,
  type ValidationIssue,
} from "./plan";
export const changeSchema = z.strictObject({
  kind: z.enum(["add", "remove", "replace", "volume", "duration", "frequency"]),
  templateId: z.string().optional(),
  itemIndex: nonnegative.optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
export type Change = z.infer<typeof changeSchema>;
export interface EngineResult<T> {
  value: T;
  diff: Change[];
  summary: z.infer<typeof bilingualSchema>;
  trace: RuleTrace[];
  noop: boolean;
  notices: EngineNotice[];
  gates: GateResult[];
}
export const engineChangeSchema = z.strictObject({
  op: z.enum([
    "replace",
    "add",
    "remove",
    "set_volume",
    "shorten",
    "frequency",
  ]),
  templateId: z.string().optional(),
  itemIndex: z.number().int().nonnegative().optional(),
  exerciseId: z.string().optional(),
  replacementId: z.string().optional(),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  loadGrams: nonnegative.optional(),
  minutes: z.number().min(10).max(90).optional(),
  daysPerWeek: z.number().int().min(1).max(6).optional(),
});
export type EngineChange = z.infer<typeof engineChangeSchema>;
export interface AdjustTodayRequest {
  minutes?: number;
  focus?: "upper" | "lower" | "full" | "core" | "mobility";
  avoidPatterns?: Pattern[];
  painArea?: Caution;
  lockedItemIndexes?: number[];
}
export type SubstituteReason =
  | "equipment"
  | "pain"
  | "dislike"
  | "too_hard"
  | "too_easy";
export interface ProgressionResult extends EngineResult<EnginePlan> {
  suggestions: {
    templateId: string;
    itemIndex: number;
    before: PlannedItem;
    after: PlannedItem;
    ruleId: string;
    summary: z.infer<typeof bilingualSchema>;
  }[];
}
export const engineCheckinSchema = z.strictObject({
  painLastedToNextMorning: z.boolean().optional(),
  painOrStiffnessWorseThanLastWeek: z.boolean().optional(),
  energyMotivation: z.number().int().min(1).max(5).optional(),
  poorSleepNights: z.number().int().nonnegative().optional(),
  sorenessResolved: z.boolean().optional(),
  newOrWorseJointPain: z.boolean().optional(),
});
export type EngineCheckin = z.infer<typeof engineCheckinSchema>;
export interface EngineValidationContext {
  progression?: {
    baseline: EnginePlan;
    history: WorkoutRecord[];
    checkin?: EngineCheckin;
    templateId?: string;
  };
}
export interface EngineApi {
  generatePlan(profile: EngineProfile, opts?: { variant?: number }): EnginePlan;
  adjustToday(
    template: SessionTemplate,
    profile: EngineProfile,
    req: AdjustTodayRequest,
  ): EngineResult<SessionTemplate>;
  modifyPlan(
    plan: EnginePlan,
    profile: EngineProfile,
    changes: EngineChange[],
  ): EngineResult<EnginePlan>;
  substitute(
    item: PlannedItem,
    profile: EngineProfile,
    reason: SubstituteReason,
  ): EngineResult<PlannedItem>;
  nextTargets(
    history: WorkoutRecord[],
    plan: EnginePlan,
    profile: EngineProfile,
    options?: { checkin?: EngineCheckin; templateId?: string },
  ): ProgressionResult;
  validatePlan(
    plan: EnginePlan,
    profile: EngineProfile,
    context?: EngineValidationContext,
  ): ValidationIssue[];
}
