import type { NutritionRecord } from '../domain/lifestyle';

/**
 * Integration seam for the future 膳食营养 (diet & nutrition) module — not planned or built yet.
 *
 * 营养建议 (route /nutrition, also /settings/nutrition) is the single home for everything about food:
 * today it holds the AI nutrition conversation and the local 饮食记录. A future module plugs in here
 * instead of adding new entries elsewhere:
 *
 * - `entries` adds its own cards to the 营养建议 page (e.g. meal ideas, intake overview).
 * - `chatContext` may offer facts to the nutrition conversation. The page shows them and sends them
 *   only after the user ticks a per-message consent box (same rule as body/history/food records);
 *   nothing is sent by default and health free text is never logged.
 * - `records` lets the module read the existing local food records through one typed interface,
 *   so it never touches the database tables directly.
 *
 * Rules the module must keep (AGENTS.md): AI output never writes data without the user's
 * confirmation; records stay local unless the user consents per message; additions to stored data
 * are new optional fields or tables with idempotent, tested migrations.
 */
export interface NutritionModuleEntry {
  id: string;
  title: { zh: string; en: string };
  description?: { zh: string; en: string };
  /** In-app route the card opens. */
  route: string;
}
export interface NutritionChatContext {
  /** Shown to the user before sending; plain words, no identifiers. */
  label: { zh: string; en: string };
  /** Structured facts only (no free text), sent only with explicit consent. */
  facts: Record<string, number | string | boolean>;
}
export interface NutritionRecordSource {
  list(): Promise<NutritionRecord[]>;
}
export interface DietModule {
  id: string;
  entries(): NutritionModuleEntry[];
  chatContext?(records: NutritionRecordSource): Promise<NutritionChatContext | undefined>;
}

const modules: DietModule[] = [];
/** Registers a diet module once (by id). No module is registered in this release. */
export function registerDietModule(module: DietModule) { if (!modules.some(row => row.id === module.id)) modules.push(module); }
export const dietModules = (): readonly DietModule[] => modules;
/** Test helper: start from no registered modules. */
export function resetDietModules() { modules.length = 0; }
