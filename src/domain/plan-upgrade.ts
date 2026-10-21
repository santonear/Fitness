// Shared contracts for the training-plan upgrade (UIUX20261008 V9.14).
// Frozen interface: component, data, rules and page lines all build against these types.
// Changing a name or meaning here needs Bo's confirmation; adding optional members does not.

/** The 15 muscle regions drawn by the AnatomyMap component, front and back. */
export const MUSCLE_GROUPS = [
  'traps', 'delts', 'chest', 'biceps', 'triceps', 'forearms', 'abs', 'obliques',
  'lats', 'lowerback', 'glutes', 'quads', 'adductors', 'hamstrings', 'calves',
] as const;
export type MuscleGroup = typeof MUSCLE_GROUPS[number];

export const MUSCLE_GROUP_NAMES: Record<MuscleGroup, [zh: string, en: string]> = {
  traps: ['斜方肌', 'Traps'], delts: ['三角肌', 'Shoulders'], chest: ['胸大肌', 'Chest'],
  biceps: ['肱二头', 'Biceps'], triceps: ['肱三头', 'Triceps'], forearms: ['前臂', 'Forearms'],
  abs: ['腹肌', 'Abs'], obliques: ['腹斜肌', 'Obliques'], lats: ['背阔肌', 'Lats'],
  lowerback: ['下背', 'Lower back'], glutes: ['臀大肌', 'Glutes'], quads: ['股四头', 'Quads'],
  adductors: ['内收肌', 'Adductors'], hamstrings: ['腘绳肌', 'Hamstrings'], calves: ['小腿', 'Calves'],
};

/** Catalog muscle ids (registry primaryMuscles / secondaryMuscles) → drawn region. */
export const MUSCLE_TO_GROUP: Readonly<Record<string, MuscleGroup>> = {
  trapezius: 'traps', rhomboids: 'traps',
  'anterior-deltoid': 'delts', 'lateral-deltoid': 'delts', 'posterior-deltoid': 'delts', supraspinatus: 'delts',
  'pectoralis-major': 'chest', 'serratus-anterior': 'chest',
  'biceps-brachii': 'biceps', brachialis: 'biceps',
  'triceps-brachii': 'triceps',
  'forearm-flexors': 'forearms', 'forearm-extensors': 'forearms', brachioradialis: 'forearms', forearms: 'forearms',
  'rectus-abdominis': 'abs', 'transverse-abdominis': 'abs',
  obliques: 'obliques',
  'latissimus-dorsi': 'lats',
  'erector-spinae': 'lowerback', 'quadratus-lumborum': 'lowerback',
  'gluteus-maximus': 'glutes', 'gluteus-medius': 'glutes', abductors: 'glutes',
  quadriceps: 'quads', 'hip-flexors': 'quads',
  adductors: 'adductors',
  hamstrings: 'hamstrings',
  gastrocnemius: 'calves', soleus: 'calves', 'tibialis-anterior': 'calves',
};

export const muscleGroupOf = (muscleId: string): MuscleGroup | undefined => MUSCLE_TO_GROUP[muscleId];

/** Fractional set counting: a primary muscle counts 1 set, a secondary muscle 0.5. */
export const PRIMARY_SET_WEIGHT = 1;
export const SECONDARY_SET_WEIGHT = 0.5;

export type MuscleLoadLevel = 'none' | 'low' | 'ok' | 'high';
export interface MuscleLoad {
  group: MuscleGroup;
  /** Fractional weekly sets. */
  sets: number;
  level: MuscleLoadLevel;
}

/** Highlight roles for one session: drives glow (primary) and pale fill (secondary). */
export interface SessionMuscleFocus {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  /** Exercise id → groups it trains, for the numbered exercise cards. */
  byExercise: Record<string, MuscleGroup[]>;
}

/** Shape inputs for the figure; all optional, missing values draw the standard figure. */
export interface FigureShape {
  sex?: 'male' | 'female';
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
}

export const HOME_PANEL_STYLES = ['hero', 'ring', 'twin'] as const;
export type HomePanelStyle = typeof HOME_PANEL_STYLES[number];
/** Bo 2026-10-21: the big-number panel is the default. */
export const DEFAULT_HOME_PANEL_STYLE: HomePanelStyle = 'hero';

export const NOW_MINUTES = [5, 15, 30, 45] as const;
export type NowMinutes = typeof NOW_MINUTES[number];

/** Optional weekly-budget layer on top of an existing plan; absent means "by day" as before. */
export interface WeeklyBudget {
  mode: 'by-day' | 'budget';
  minutesPerWeek?: number;
  setsPerGroupPerWeek?: number;
}

/** One "how much time do you have now" request handed to the rules engine. */
export interface BudgetRequest {
  minutes: NowMinutes;
  variant?: 'standard' | 'tired' | 'no-equipment';
  scene?: 'commute' | 'office' | 'bedtime';
}

/** Home-testable items of 国民体质测定标准（2023 年修订）. */
export const FITNESS_TEST_ITEMS = ['pushup', 'situp60s', 'sitAndReachCm', 'singleLegStandEyesClosedS', 'chairStand30s'] as const;
export type FitnessTestItem = typeof FITNESS_TEST_ITEMS[number];

export interface FitnessTestRecord {
  id: string;
  localDate: string;
  /** Kneeling push-ups for women follow the standard; the value is the count either way. */
  results: Partial<Record<FitnessTestItem, number>>;
  createdAt: string;
}

export const ROUTES = ['health', 'shape', 'postpartum'] as const;
export type Route = typeof ROUTES[number];

export interface Camp {
  id: string;
  title: string;
  metric: FitnessTestItem | 'weightKg' | 'waistCm' | 'sessions';
  start: number;
  target: number;
  reachedAt?: string;
}

/** 我的山路: destination in the user's own words, camps checked by tests and body data. */
export interface Journey {
  id: string;
  route: Route;
  secondaryRoute?: Route;
  destination: string;
  camps: Camp[];
  version: number;
  createdAt: string;
}

export interface FutureLetter {
  id: string;
  text: string;
  createdAt: string;
  openAtCampId?: string;
  openedAt?: string;
}

/** Body-change lines (wording v5 §19). Triggered by code only, never by the model. */
export type BodyChangeKind = 'stronger' | 'lighter' | 'waist' | 'feel' | 'care-fast-loss' | 'care-low-bmi';
export interface BodyChangeEvent {
  kind: BodyChangeKind;
  metric: string;
  delta: number;
  sinceLocalDate: string;
}

/**
 * Single storage upgrade for the whole upgrade (DATABASE_VERSION 20 → 21), owned by the data line:
 * - new tables `fitnessTests` (FitnessTestRecord), `journeys` (Journey), `futureLetters` (FutureLetter);
 * - optional `weeklyBudget` on plan versions, optional `homePanelStyle` on preferences;
 * - body sex/height/weight/waist and weight history reuse body-profile and `bodyWeights` unchanged.
 */
export const PLAN_UPGRADE_DATABASE_VERSION = 21;

// ---- Frozen signatures between lines (implemented by the owning line; stubs return neutral values) ----

/** Component line: src/ui/components/kit/AnatomyMap.tsx */
export interface AnatomyMapProps {
  width: number;
  primary: readonly MuscleGroup[];
  secondary: readonly MuscleGroup[];
  shape?: FigureShape;
  /** Numbered badges with leader lines (the "今天练这里" page); off for small panels. */
  labels?: boolean;
  /** Previous weight drawn as a dashed outline (我的山路). */
  ghostWeightKg?: number;
}

/** Component line: src/ui/components/kit/HomePanel.tsx */
export interface HomePanelProps {
  style: HomePanelStyle;
  minutes: NowMinutes;
  onMinutes: (minutes: NowMinutes) => void;
  onStart: () => void;
  focus: SessionMuscleFocus;
  weekLoads: readonly MuscleLoad[];
  weekDone: number;
  weekTarget: number;
  shape?: FigureShape;
  coachLine?: string;
}

/** Component line: src/ui/components/kit/JourneyTrail.tsx */
export interface JourneyStop { label: string; state: 'done' | 'now' | 'next' }
export interface JourneyTrailProps { stops: readonly JourneyStop[] }

/** Rules line: src/application/rules/plan-upgrade.ts */
export interface SetEntry { exerciseId: string; completedSets: number }
export interface LiftEntry { exerciseId: string; localDate: string; weightKg: number; reps: number }
export interface PersonalRecord { exerciseId: string; e1rmKg: number; localDate: string }
export interface NowSessionContext { weekLoads: readonly MuscleLoad[]; usedMinutesThisWeek: number; budget?: WeeklyBudget; planId?: string }
export interface NowSession { exerciseIds: string[]; minutes: number; focus: SessionMuscleFocus }
export interface BodyAgeResult { years: number; items: number; estimated: true }
export interface BodyChangeInput {
  route?: Route;
  heightCm?: number;
  weights: readonly { localDate: string; weightKg: number }[];
  records: readonly PersonalRecord[];
  tests: readonly FitnessTestRecord[];
  lastSpokenByKind: Partial<Record<BodyChangeKind, string>>;
  today: string;
}
