// Data line owns this file (UIUX20261008 V9.14). Signatures are frozen; stubs keep other lines building.
import type { FitnessTestRecord, FutureLetter, HomePanelStyle, Journey, WeeklyBudget } from '../domain/plan-upgrade';
import { DEFAULT_HOME_PANEL_STYLE } from '../domain/plan-upgrade';

export async function listFitnessTests(): Promise<FitnessTestRecord[]> { return []; }
export async function addFitnessTest(_record: Omit<FitnessTestRecord, 'id' | 'createdAt'>): Promise<FitnessTestRecord | undefined> { return undefined; }
export async function currentJourney(): Promise<Journey | undefined> { return undefined; }
/** Saves a new journey version; earlier versions stay. */
export async function saveJourneyVersion(_journey: Omit<Journey, 'id' | 'version' | 'createdAt'>): Promise<Journey | undefined> { return undefined; }
export async function listFutureLetters(): Promise<FutureLetter[]> { return []; }
export async function saveFutureLetter(_text: string, _openAtCampId?: string): Promise<FutureLetter | undefined> { return undefined; }
export async function markLetterOpened(_id: string): Promise<void> {}
export async function homePanelStyle(): Promise<HomePanelStyle> { return DEFAULT_HOME_PANEL_STYLE; }
export async function setHomePanelStyle(_style: HomePanelStyle): Promise<void> {}
export async function weeklyBudget(_planId: string): Promise<WeeklyBudget | undefined> { return undefined; }
/** Plan changes always create a new plan version. */
export async function setWeeklyBudget(_planId: string, _budget: WeeklyBudget): Promise<void> {}
