import type { PlanVersion } from '../../../domain/v8/contracts';
import zh from './zh';
import en from './en';
export type PlanLanguage = 'zh' | 'en';
export const planMessages = { zh, en } satisfies Record<PlanLanguage, { origins: Record<PlanVersion['origin'], string> } & Record<string, unknown>>;
