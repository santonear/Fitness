import { z } from 'zod';
import type { SessionTemplate } from '../../domain/v8/contracts';
import type { Rules, Exercise } from '../data';
import type { EngineProfile, Weekday, Pattern } from './profile';
import type {
  GateResult,
  EngineNotice,
  RuleTrace,
  EnginePrescription,
  engineItemSchema,
  EnginePlan,
  ValidationIssue,
} from './plan';
import type { AdjustTodayRequest } from './api';
/** V2 P0 shared interfaces. Legacy fields are read-compatible until M3. */
export interface GateState {
  blocked: boolean;
  gates: GateResult[];
  notices: EngineNotice[];
  trace: RuleTrace[];
  user: Record<string, any>;
  maxRpe: number;
  rirMin: number;
  phase: number;
  population: 'general' | 'older_adult' | 'pregnant' | 'postpartum';
  eligibility: Map<string, boolean>;
  cooldownHoldSeconds?: number;
  cooldownPrimaryOnly?: boolean;
}
export interface GateOutcome {
  status: 'ok' | 'restricted' | 'blocked';
  restrictions: GateState & {
    maxIntensity: number;
    allowedBundles: string[];
    excludeFlags: string[];
    excludePositions: string[];
  };
  reasons: GateResult[];
  trace: RuleTrace[];
  notices: EngineNotice[];
}
export interface DayPlan {
  id: string;
  index: number;
  kind: 'full' | 'upper' | 'lower' | 'aerobic' | 'mobility' | 'early_postpartum';
  minutes: number;
  weekday?: Weekday;
  balanceRequired: boolean;
  sourceDayRuleId?: string;
}
export interface WeekSkeleton {
  days: DayPlan[];
  trace: RuleTrace[];
}
export interface Slot {
  id: string;
  role: EnginePrescription['block'];
  patterns: Pattern[];
  priority: number;
  optional: boolean;
  sourceRuleId: string;
  region?: 'lower_body' | 'upper_body' | 'trunk';
}
export type Candidate = Exercise;
export type SessionDraft = Omit<SessionTemplate, 'items'> & {
  items: z.infer<typeof engineItemSchema>[];
  slots: Slot[];
  estimatedSeconds?: number;
  targetMinutes?: number;
};
export type Plan = EnginePlan;
export interface RuleSatisfaction {
  id: string;
  weight: number;
  satisfaction: number;
}
export interface ScoreResult {
  quality: number;
  perRule: RuleSatisfaction[];
  advice: { id: string; satisfied: boolean }[];
}
export interface PlanChange {
  kind: 'add' | 'replace' | 'move-set' | 'remove';
  templateId: string;
  itemIndex?: number;
  item?: z.infer<typeof engineItemSchema>;
  fromIndex?: number;
  toIndex?: number;
}
export interface VolumeBudget {
  weeklyTargets: Record<string, number>;
  bySlot: Record<string, number>;
}
export interface PipelineContext {
  profile: EngineProfile;
  gate: GateOutcome;
  rules: Rules;
  variant: number;
  profileHash: string;
  rng: () => number;
  trace: RuleTrace[];
  currentWeekday?: Weekday;
  usedIds: Set<string>;
  usedLadders: Set<string>;
  plan?: Plan;
  volumeBudget?: VolumeBudget;
  lockedItemIndexes?: number[];
  focus?: AdjustTodayRequest['focus'];
}
export interface Scorer {
  score: (plan: Plan, profile: EngineProfile, rules?: Rules) => ScoreResult;
  marginal: (plan: Plan, change: PlanChange, profile: EngineProfile, rules?: Rules) => number;
}
export type HardViolation = ValidationIssue;
