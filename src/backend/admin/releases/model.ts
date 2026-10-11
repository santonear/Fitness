import { z } from 'zod';
import { featureNames, type FeatureName } from '../../../domain/feature-flags';
import { COACH_V8_PROMPT_VERSION, COACH_V8_PREVIOUS_PROMPT_VERSION } from '../../coach-v8-version';
import type { AdminEnvironment } from '../core/contracts';

export const environmentSchema = z.enum(['preview', 'production']);
export type ReleaseEnvironment = z.infer<typeof environmentSchema>;
export const promptTasks = ['ONBOARD_PLAN', 'ADJUST_TODAY', 'MODIFY_PLAN', 'PERIOD_REVIEW'] as const;
export const registeredPromptVersions = [COACH_V8_PROMPT_VERSION, COACH_V8_PREVIOUS_PROMPT_VERSION] as const;
export const sensitiveFeatures = new Set<FeatureName>(['systemNotifications', 'aiOperations', 'errorReports', 'anonymousUsage', 'nutrition', 'activityImport']);
export const flagChangeSchema = z.object({ name: z.enum(featureNames), environment: environmentSchema, enabled: z.boolean(), confirmed: z.literal(true).optional() }).strict();
export const promptChangeSchema = z.object({ task: z.enum(promptTasks), environment: environmentSchema, version: z.enum(registeredPromptVersions), confirmed: z.literal(true) }).strict();
export const rollbackSchema = z.object({ environment: environmentSchema, expectedCurrent: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/), target: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/), confirmed: z.literal(true) }).strict();
export const smokeChecks = ['application', 'features', 'managementAccess'] as const;
export type SmokeCheck = { check: typeof smokeChecks[number]; status: 'passed' | 'failed' | 'unavailable'; checkedAt: string };
export interface ReleaseRegistration { id: string; deploymentId: string; publishedAt: string; compatibleDataVersion: number; smokeOrigin: string }
export interface ReleaseRegistry { environment: ReleaseEnvironment; dataVersion: number; current: ReleaseRegistration; previous?: ReleaseRegistration }
export interface FlagRow { name: FeatureName; environment: ReleaseEnvironment; enabled: number; pending: number; changed_by: string; changed_at: string }
export interface ReleaseStatement { bind(...values: unknown[]): ReleaseStatement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ success: boolean; meta?: { changes?: number } }> }
export interface ReleaseDatabase { prepare(sql: string): ReleaseStatement; batch(statements: ReleaseStatement[]): Promise<unknown[]> }
export interface ReleasesEnv extends AdminEnvironment { ADMIN_RELEASE_REGISTRY?: string; ADMIN_RELEASE_ADAPTER?: { fetch(request: Request): Promise<Response> }; ADMIN_PREVIEW_SIMULATION?:{fetch(request:Request):Promise<Response>} }
