// Data line owns this file (UIUX20261008 V9.14). Signatures are frozen.
import type { FitnessTestRecord, FutureLetter, HomePanelStyle, Journey, WeeklyBudget } from '../domain/plan-upgrade';
import { DEFAULT_HOME_PANEL_STYLE, HOME_PANEL_STYLES } from '../domain/plan-upgrade';
import {
  fitnessTestRecordSchema,
  futureLetterSchema,
  journeySchema,
  v8PlanVersionSchema,
  v8StateSchema,
  weeklyBudgetSchema,
} from '../domain/schemas';
import { DomainError } from '../domain/errors';
import { repository, type Repository } from './repository';

const now = () => new Date().toISOString();
function parse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new DomainError('INVALID', 'Invalid plan upgrade data');
  return result.data;
}
const sameBudget = (a: WeeklyBudget | undefined, b: WeeklyBudget | undefined) =>
  JSON.stringify(
    a && { mode: a.mode, minutesPerWeek: a.minutesPerWeek, setsPerGroupPerWeek: a.setsPerGroupPerWeek },
  ) ===
  JSON.stringify(b && { mode: b.mode, minutesPerWeek: b.minutesPerWeek, setsPerGroupPerWeek: b.setsPerGroupPerWeek });

export function createPlanUpgradeStore(repo: Repository) {
  const { db } = repo;
  return {
    async listFitnessTests(): Promise<FitnessTestRecord[]> {
      return (await db.fitnessTests.toArray()).sort(
        (a, b) => a.localDate.localeCompare(b.localDate) || a.createdAt.localeCompare(b.createdAt),
      );
    },
    /** Saved test records are read-only: only `add` is used, so an existing record can never be overwritten. */
    async addFitnessTest(record: Omit<FitnessTestRecord, 'id' | 'createdAt'>): Promise<FitnessTestRecord | undefined> {
      const row = parse<FitnessTestRecord>(fitnessTestRecordSchema, {
        localDate: record.localDate,
        results: record.results,
        id: crypto.randomUUID(),
        createdAt: now(),
      });
      return repo.write(async () => {
        await db.fitnessTests.add(row);
        return row;
      });
    },
    async currentJourney(): Promise<Journey | undefined> {
      return db.journeys.orderBy('version').last();
    },
    /** Saves a new journey version; earlier versions stay. */
    async saveJourneyVersion(journey: Omit<Journey, 'id' | 'version' | 'createdAt'>): Promise<Journey | undefined> {
      return repo.write(async () => {
        const previous = await db.journeys.orderBy('version').last();
        const row = parse<Journey>(journeySchema, {
          route: journey.route,
          ...(journey.secondaryRoute ? { secondaryRoute: journey.secondaryRoute } : {}),
          destination: journey.destination,
          camps: journey.camps,
          id: crypto.randomUUID(),
          version: (previous?.version ?? 0) + 1,
          createdAt: now(),
        });
        await db.journeys.add(row);
        return row;
      });
    },
    async listFutureLetters(): Promise<FutureLetter[]> {
      return await db.futureLetters.orderBy('createdAt').toArray();
    },
    async saveFutureLetter(text: string, openAtCampId?: string): Promise<FutureLetter | undefined> {
      const row = parse<FutureLetter>(futureLetterSchema, {
        id: crypto.randomUUID(),
        text: text.trim(),
        createdAt: now(),
        ...(openAtCampId ? { openAtCampId } : {}),
      });
      return repo.write(async () => {
        await db.futureLetters.add(row);
        return row;
      });
    },
    /** Records the first opening only; the letter text never changes. */
    async markLetterOpened(id: string): Promise<void> {
      await repo.write(async () => {
        const letter = await db.futureLetters.get(id);
        if (!letter) throw new DomainError('INVALID', 'LETTER_NOT_FOUND');
        if (letter.openedAt) return;
        await db.futureLetters.put(parse<FutureLetter>(futureLetterSchema, { ...letter, openedAt: now() }));
      });
    },
    async homePanelStyle(): Promise<HomePanelStyle> {
      const stored = (await db.v8State.get('v8'))?.homePanelStyle;
      return stored && HOME_PANEL_STYLES.includes(stored) ? stored : DEFAULT_HOME_PANEL_STYLE;
    },
    async setHomePanelStyle(style: HomePanelStyle): Promise<void> {
      await repo.write(async () => {
        const state = await db.v8State.get('v8');
        if (!state) throw new DomainError('INVALID', 'Local profile is not initialized');
        if (state.homePanelStyle === style) return;
        await db.v8State.put(parse(v8StateSchema, { ...state, homePanelStyle: style }));
      });
    },
    async weeklyBudget(planId: string): Promise<WeeklyBudget | undefined> {
      const plan = await db.v8Plans.get(planId);
      return plan ? (await db.v8PlanVersions.get(plan.currentVersionId))?.weeklyBudget : undefined;
    },
    /** Plan changes always create a new plan version; the previous version is never modified. */
    async setWeeklyBudget(planId: string, budget: WeeklyBudget): Promise<void> {
      const next = parse<WeeklyBudget>(weeklyBudgetSchema, budget);
      await repo.write(async () => {
        const plan = await db.v8Plans.get(planId);
        const version = plan ? await db.v8PlanVersions.get(plan.currentVersionId) : undefined;
        if (!plan || !version || plan.readOnly || plan.deletedAt) throw new DomainError('INVALID', 'PLAN_UNAVAILABLE');
        if (sameBudget(version.weeklyBudget, next)) return;
        if (await db.v8Workouts.where('status').equals('in_progress').count())
          throw new DomainError('CONFLICT', 'TRAINING_CHANGED');
        const locale = (await db.profiles.toCollection().first())?.locale ?? 'zh';
        const summary =
          next.mode === 'budget'
            ? locale === 'zh'
              ? '改为每周预算'
              : 'Switched to a weekly budget'
            : locale === 'zh'
              ? '改为按天安排'
              : 'Switched to day-by-day';
        const created = v8PlanVersionSchema.parse({
          ...version,
          id: crypto.randomUUID(),
          versionNumber: version.versionNumber + 1,
          createdAt: now(),
          origin: 'manual',
          source: 'local',
          basedOnVersionId: version.id,
          reviewRule: undefined,
          changeSummary: [summary],
          weeklyBudget: next,
        });
        await db.v8PlanVersions.add(created);
        await db.v8Plans.put({ ...plan, currentVersionId: created.id });
        // A today-only adjustment of the same plan stays attached to the new version.
        const state = await db.v8State.get('v8');
        if (state?.nextWorkoutOverride?.planVersionId === version.id)
          await db.v8State.put({
            ...state,
            nextWorkoutOverride: { ...state.nextWorkoutOverride, planVersionId: created.id },
          });
      });
    },
  };
}

export type PlanUpgradeStore = ReturnType<typeof createPlanUpgradeStore>;
const store = createPlanUpgradeStore(repository);

export const listFitnessTests = (): Promise<FitnessTestRecord[]> => store.listFitnessTests();
export const addFitnessTest = (
  record: Omit<FitnessTestRecord, 'id' | 'createdAt'>,
): Promise<FitnessTestRecord | undefined> => store.addFitnessTest(record);
export const currentJourney = (): Promise<Journey | undefined> => store.currentJourney();
/** Saves a new journey version; earlier versions stay. */
export const saveJourneyVersion = (
  journey: Omit<Journey, 'id' | 'version' | 'createdAt'>,
): Promise<Journey | undefined> => store.saveJourneyVersion(journey);
export const listFutureLetters = (): Promise<FutureLetter[]> => store.listFutureLetters();
export const saveFutureLetter = (text: string, openAtCampId?: string): Promise<FutureLetter | undefined> =>
  store.saveFutureLetter(text, openAtCampId);
export const markLetterOpened = (id: string): Promise<void> => store.markLetterOpened(id);
export const homePanelStyle = (): Promise<HomePanelStyle> => store.homePanelStyle();
export const setHomePanelStyle = (style: HomePanelStyle): Promise<void> => store.setHomePanelStyle(style);
export const weeklyBudget = (planId: string): Promise<WeeklyBudget | undefined> => store.weeklyBudget(planId);
/** Plan changes always create a new plan version. */
export const setWeeklyBudget = (planId: string, budget: WeeklyBudget): Promise<void> =>
  store.setWeeklyBudget(planId, budget);
