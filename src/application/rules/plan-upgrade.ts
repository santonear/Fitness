// Rules line owns this file (UIUX20261008 V9.14). Signatures are frozen in src/domain/plan-upgrade.ts;
// these stubs return neutral values so other lines can build in parallel.
import type {
  BodyAgeResult, BodyChangeEvent, BodyChangeInput, BudgetRequest, Camp, FitnessTestItem, LiftEntry, MuscleLoad,
  NowSession, NowSessionContext, PersonalRecord, SessionMuscleFocus, SetEntry,
} from '../../domain/plan-upgrade';

export function weeklyMuscleLoad(_entries: readonly SetEntry[]): MuscleLoad[] { return []; }
export function sessionMuscleFocus(_exerciseIds: readonly string[]): SessionMuscleFocus { return { primary: [], secondary: [], byExercise: {} }; }
export function estimateE1rm(_weightKg: number, _reps: number): number | undefined { return undefined; }
export function personalRecords(_history: readonly LiftEntry[]): PersonalRecord[] { return []; }
export function buildNowSession(_request: BudgetRequest, _context: NowSessionContext): NowSession | undefined { return undefined; }
export function bodyAge(_sex: 'male' | 'female', _age: number, _results: Partial<Record<FitnessTestItem, number>>): BodyAgeResult | undefined { return undefined; }
export function bodyChangeEvents(_input: BodyChangeInput): BodyChangeEvent[] { return []; }
export function campProgress(_camp: Camp, _latest: number): number { return 0; }
export function skipPattern(_trainedDates: readonly string[], _plannedDates: readonly string[]): { weekday: number } | undefined { return undefined; }
