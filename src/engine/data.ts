import type {
  EngineNotice,
  EngineProfile,
  Pattern,
  RuleTrace,
  Weekday,
} from "./contracts";
import type { PlannedItem } from "../domain/v8/contracts";
import compiledRules from "./generated/rules-runtime.json" with { type: "json" };
import compiledExercises from "./generated/exercise-index.json" with { type: "json" };

/** Rule values intentionally retain their authored shape. Their schema is checked by the compiler. */
export type RuleValue = Record<string, any>;
export interface Rule {
  id: string;
  type: string;
  chapter: number;
  severity?: "hard" | "target" | "advice" | "mechanic" | "copy" | "meta";
  weight?: number;
  value?: RuleValue;
  applies?: RuleValue;
  zh?: unknown;
  en?: unknown;
}
export interface Exercise {
  id: string;
  slug: string;
  name: { zh: string; en: string };
  metricType: "reps" | "reps_load" | "duration" | "duration_distance";
  primary_pattern: Pattern;
  secondary_patterns: Pattern[];
  modality: string;
  nsca_class: string;
  laterality: string;
  difficulty: number;
  joint_load: Record<string, number>;
  impact: number;
  noise: number;
  space: string;
  position: string[];
  flags: string[];
  use: string[];
  ladder: { id: string | null; step: number };
  default_dose: Record<
    string,
    {
      sets: number[];
      reps: number[] | null;
      seconds: number[] | null;
      rir: number[];
    } | null
  >;
  time: { setup_s: number; s_per_rep: number; per_side: boolean };
  equipment_required: string[];
  equipment_alternatives: Record<string, string[]>;
  balance?: {
    base: "wide" | "narrow" | "tandem" | "single_leg";
    mode: "static" | "dynamic";
    hand_support: boolean;
  };
  confidence: string;
  review: boolean;
  bodyPart?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  excluded_cautions?: string[];
  requires_floor_transition?: boolean;
  supported_variant_available?: boolean;
  mobility_type?: "dynamic" | "static";
  stretch_targets?: string[];
  stretch_hold_s?: [number, number];
}
export interface Copy {
  zh: string;
  en: string;
  sourceRuleId: string;
  path: string;
}
export interface EngineData {
  rulesVersion: string;
  rules: Rule[];
  copy: Record<string, Copy>;
  exercises: Exercise[];
  byPattern?: Record<string, string[]>;
}
export function stretchHoldRange(
  e: Exercise,
  r: Rules,
  population: string,
): [number, number] | undefined {
  const hold = r.get("dose.stretch").hold_s,
    global = population === "older_adult" ? hold.older_adult : hold.range,
    source = e.stretch_hold_s ?? global,
    min = Math.max(global[0], source[0]),
    max = Math.min(global[1], source[1]);
  return min <= max ? [min, max] : undefined;
}
/** A higher cap permits verified lower stages; unknown catalog facts never satisfy a stage. */
export function balanceStageEligible(
  e: Exercise,
  cap: number,
  r: Rules,
): boolean {
  if (e.primary_pattern !== r.get("older.balance.progression").pattern)
    return true;
  const fact = e.balance;
  if (!fact) return false;
  return r
    .get("older.balance.progression")
    .stages.some(
      (stage: RuleValue) =>
        stage.stage <= cap &&
        stage.base.split("_or_").includes(fact.base) &&
        (stage.mode === "dynamic_allowed" || fact.mode === stage.mode) &&
        stage.hand_support === fact.hand_support,
    );
}
export const DATA: EngineData = {
  rulesVersion: compiledRules.rulesVersion,
  rules: compiledRules.rules as Rule[],
  copy: compiledRules.copy,
  exercises: compiledExercises.exercises as unknown as Exercise[],
  byPattern: compiledExercises.byPattern,
};
export class Rules {
  readonly byId: Map<string, Rule>;
  readonly byExercise: Map<string, Exercise>;
  constructor(readonly data: EngineData = DATA) {
    this.byId = new Map(data.rules.map((r) => [r.id, r]));
    this.byExercise = new Map(data.exercises.map((e) => [e.id, e]));
  }
  get(id: string): RuleValue {
    const r = this.byId.get(id);
    if (!r) throw new Error(`Missing compiled training rule: ${id}`);
    return r.value ?? {};
  }
  pattern(pattern: Pattern): Exercise[] {
    const ids = this.data.byPattern?.[pattern];
    return ids
      ? ids
          .map((id) => this.byExercise.get(id))
          .filter((e): e is Exercise => !!e && e.primary_pattern === pattern)
      : this.data.exercises.filter((e) => e.primary_pattern === pattern);
  }
  text(
    key: string,
    params: Record<string, string | number> = {},
  ): { zh: string; en: string } {
    const copy = this.data.copy[key];
    if (!copy) throw new Error(`Missing compiled training copy: ${key}`);
    const render = (value: string) =>
      value.replace(/\{([^}]+)\}/g, (_token, name: string) => {
        if (!(name in params))
          throw new Error(`Missing copy parameter: ${key}.${name}`);
        return String(params[name]);
      });
    return { zh: render(copy.zh), en: render(copy.en) };
  }
  trace(
    trace: RuleTrace[],
    id: string,
    reason: string,
    details?: Record<string, unknown>,
  ) {
    if (!trace.some((t) => t.ruleId === id && t.reason === reason))
      trace.push({ ruleId: id, reason, ...(details ? { details } : {}) });
  }
  notice(
    notices: EngineNotice[],
    key: string,
    severity: EngineNotice["severity"] = "info",
    params: Record<string, string | number> = {},
  ) {
    const entry =
      this.data.copy[key] ??
      Object.values(this.data.copy).find(
        (c) => c.sourceRuleId === key && typeof c.zh === "string",
      );
    if (!entry) return false;
    const format = (s: string) =>
      s.replace(/\{([^}]+)\}/g, (token, k: string) =>
        String(params[k] ?? token),
      );
    if (!notices.some((n) => n.code === key))
      notices.push({
        code: key,
        ruleId: entry.sourceRuleId,
        copyPath: entry.path,
        severity,
        message: { zh: format(entry.zh), en: format(entry.en) },
      });
    return true;
  }
}
export function stableString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableString).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableString(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function hash(value: unknown): string {
  let h = 2166136261;
  for (const c of stableString(value)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function midpoint(
  range: number[] | undefined,
  fallback: number,
): number {
  return range?.length
    ? Math.ceil((range[0] + range[range.length - 1]) / 2)
    : fallback;
}
export function age(profile: EngineProfile): number | undefined {
  if (profile.birthYearMonth && profile.asOfDate) {
    const [by, bm] = profile.birthYearMonth.split("-").map(Number);
    const [y, m] = profile.asOfDate.split("-").map(Number);
    return y - by - (m < bm ? 1 : 0);
  }
  return profile.ageYears;
}
export function elapsedDays(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86400000;
}
// Cache only bounded, non-user-specific formatters; never dates or health profiles.
const calendarFormatters = new Map<string, Intl.DateTimeFormat>();
/** Date-only values are caller calendar dates; instants are projected into the caller's explicit zone. */
export function calendarDay(
  value: string,
  timeZone = "UTC",
): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return Number.isFinite(Date.parse(value)) ? value : undefined;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return undefined;
  try {
    let formatter = calendarFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      if (calendarFormatters.size >= 16) {
        const oldest = calendarFormatters.keys().next().value;
        if (oldest !== undefined) calendarFormatters.delete(oldest);
      }
      calendarFormatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(instant);
    const read = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${read("year")}-${read("month")}-${read("day")}`;
  } catch {
    return undefined;
  }
}
export function addCalendarMonths(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date, last));
  return target.toISOString().slice(0, 10);
}
export function getPath(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (v, k) =>
        v && typeof v === "object"
          ? (v as Record<string, unknown>)[k]
          : undefined,
      value,
    );
}
export function condition(
  expr: unknown,
  exercise: Exercise,
  user: RuleValue,
): boolean {
  if (!expr || typeof expr !== "object") return false;
  const e = expr as RuleValue;
  if (e.any)
    return (e.any as unknown[]).some((x) => condition(x, exercise, user));
  if (e.all)
    return (e.all as unknown[]).every((x) => condition(x, exercise, user));
  if (e.not) return !condition(e.not, exercise, user);
  if (e.flag || e.position || e.use) {
    const key = e.flag ? "flags" : e.position ? "position" : "use";
    const values = e.flag ?? e.position ?? e.use;
    return (Array.isArray(values) ? values : [values]).some((v: string) =>
      exercise[key].includes(v),
    );
  }
  const actual = getPath(e.user ? user : exercise, e.user ?? e.field ?? "");
  if ("is" in e) return actual === e.is;
  if ("eq" in e) return actual === e.eq;
  if ("ne" in e) return actual !== e.ne;
  if ("in" in e) return e.in.includes(actual);
  if ("not_in" in e) return !e.not_in.includes(actual);
  if ("contains" in e)
    return Array.isArray(actual) && actual.includes(e.contains);
  if ("contains_any" in e)
    return (
      Array.isArray(actual) &&
      e.contains_any.some((v: unknown) => actual.includes(v))
    );
  if (typeof actual !== "number") return false;
  return "gte" in e
    ? actual >= e.gte
    : "gt" in e
      ? actual > e.gt
      : "lte" in e
        ? actual <= e.lte
        : "lt" in e
          ? actual < e.lt
          : false;
}
/** Older adults use the authored shorter detraining threshold; missing evidence never extends it. */
export function detrainingGapDays(
  profile: EngineProfile,
  rules: Rules,
): number {
  const older =
    profile.population.kind === "older_adult" ||
    (age(profile) ?? 0) >= rules.get("older.activation").trigger.any[0].gte;
  return (
    rules.get("progression.return.classify").classes.trained.gap_days_max *
    (older
      ? rules.get("older.return_after_break").detraining_threshold_multiplier
      : 1)
  );
}
/** Only explicit catalog and prescribed intensity facts can exempt an item. */
export function requiresAlternatingDay(
  item: PlannedItem,
  rules: Rules,
): boolean {
  const e = rules.byExercise.get(item.exerciseId),
    scope = rules.get("variety.no_repeat").adjacent_day_scope;
  if (!e || !scope) return true;
  if (scope.restricted_modalities.includes(e.modality)) return true;
  if (scope.exempt_modalities.includes(e.modality)) return false;
  if (e.modality === scope.isometric.modality)
    return !Object.entries(scope.isometric.exempt_facts).every(
      ([path, value]) => getPath(e, path) === value,
    );
  if (e.modality !== scope.cardio.modality) return true;
  const cardio = scope.cardio,
    p = item.prescription,
    rpe = p?.targetRpe,
    ref = cardio.max_rpe_source,
    cap = getPath(rules.get(ref.rule_id), ref.path);
  return (
    cardio.excluded_training_styles.includes(p?.trainingStyle) ||
    cardio.excluded_flags.some((flag: string) => e.flags.includes(flag)) ||
    !rpe ||
    !rpe.every(Number.isFinite) ||
    rpe[0] < rules.get(ref.rule_id).scale[0] ||
    rpe[0] > rpe[1] ||
    typeof cap !== "number" ||
    rpe[1] > cap
  );
}
export function adjacentTrainingDays(a: Weekday, b: Weekday): boolean {
  const days: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    left = days.indexOf(a),
    right = days.indexOf(b);
  return (
    left >= 0 &&
    right >= 0 &&
    (Math.abs(left - right) === 1 || Math.abs(left - right) === days.length - 1)
  );
}
export function restrictedAdjacentIds(
  templates: readonly { weekday?: Weekday; items: readonly PlannedItem[] }[],
  weekday: Weekday | undefined,
  rules: Rules,
): Set<string> {
  return new Set(
    weekday
      ? templates
          .filter((t) => t.weekday && adjacentTrainingDays(t.weekday, weekday))
          .flatMap((t) =>
            t.items
              .filter((item) => requiresAlternatingDay(item, rules))
              .map((item) => item.exerciseId),
          )
      : [],
  );
}
