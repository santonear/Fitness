import { z } from 'zod';
import { readTrialReceipt } from '../ai/trial-recovery';
export const accessStatusSchema = z.object({
  qualification: z.enum(['none', 'active', 'expired', 'revoked']),
  sessionValid: z.boolean(),
  expiresAt: z.number().finite().optional(),
  aiEnabled: z.boolean().optional(),
  summaryAvailable: z.boolean().optional(),
  planningBudgetDisabled: z.boolean().optional(),
  used: z.object({ generate: z.number(), understand: z.number().optional() }).optional(),
  limits: z.object({ generate: z.number(), understand: z.number().optional() }).optional(),
});
export type AccessStatus = z.infer<typeof accessStatusSchema>;
type AccessReason = 'invalid' | 'disabled' | 'quota' | 'connection';
const previousAccessKey = 'fitness.access-confirmed.v1';
export function hadConfirmedAccess() {
  try {
    return localStorage.getItem(previousAccessKey) === 'yes';
  } catch {
    return false;
  }
}
const pending = new Map<typeof fetch, Promise<AccessStatus>>();
export async function readAccessStatus(fetcher: typeof fetch = fetch): Promise<AccessStatus> {
  const existing = pending.get(fetcher);
  if (existing) return existing;
  const owner = readTrialReceipt();
  const request = (async () => {
    const response = await fetcher('/api/v1/trial/access-status', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(owner ? { receipt: owner } : {}),
    });
    if (!response.ok || response.redirected || response.type === 'opaqueredirect') throw Error('CONTROL_UNAVAILABLE');
    const status = accessStatusSchema.parse(await response.json());
    if (status.qualification === 'active' && status.sessionValid) {
      try {
        localStorage.setItem(previousAccessKey, 'yes');
      } catch {
        /* Server status remains authoritative. */
      }
    }
    return status;
  })().finally(() => pending.delete(fetcher));
  pending.set(fetcher, request);
  return request;
}
export function accessReason(status: AccessStatus, task?: string): AccessReason | undefined {
  if (status.qualification !== 'active' || !status.sessionValid) return 'invalid';
  if (status.aiEnabled !== true || (task === 'PERIOD_REVIEW' && status.summaryAvailable !== true)) return 'disabled';
  if (
    task !== 'PERIOD_REVIEW' &&
    !status.planningBudgetDisabled &&
    status.used &&
    status.limits &&
    status.used.generate >= status.limits.generate
  )
    return 'quota';
}
export function errorAccessReason(error: unknown): AccessReason {
  const code = error instanceof Error ? error.message : '';
  return ['QUALIFICATION_REQUIRED', 'SUBJECT_EXPIRED', 'SUBJECT_NOT_FOUND'].includes(code)
    ? 'invalid'
    : code === 'AI_DISABLED'
      ? 'disabled'
      : ['INDIVIDUAL_QUOTA_EXHAUSTED', 'GLOBAL_BUDGET_EXHAUSTED', 'DAILY_USAGE_FALLBACK', 'DAILY_USAGE_LIMIT'].includes(
            code,
          )
        ? 'quota'
        : 'connection';
}
export const accessCopy = {
  zh: {
    reasons: {
      invalid: '还没开通 AI 助手芽芽',
      disabled: 'AI 助手芽芽暂时关闭',
      quota: '今天次数用完了',
      connection: '连接失败',
    },
  },
  en: {
    reasons: {
      invalid: 'AI assistant Yaya is not on yet',
      disabled: 'AI assistant Yaya is paused',
      quota: 'Used up for today',
      connection: 'Connection failed',
    },
  },
};
