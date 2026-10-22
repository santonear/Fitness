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
    title: 'AI 资格',
    loading: '正在确认资格…',
    active: 'AI 资格有效',
    invalid: '此浏览器的资格已失效',
    none: '此浏览器尚未领取 AI 资格',
    restore: '恢复领取或申请补发',
    refresh: '刷新资格',
    local: '现在用的是本地建议',
    reasons: { invalid: '资格无效', disabled: 'AI 已关闭', quota: '额度用完', connection: '连接失败' },
  },
  en: {
    title: 'AI access',
    loading: 'Checking access…',
    active: 'AI access is active',
    invalid: 'Access on this browser is no longer valid',
    none: 'AI access has not been claimed on this browser',
    restore: 'Recover access or request a replacement',
    refresh: 'Refresh access',
    local: 'Using local suggestions',
    reasons: {
      invalid: 'Access is invalid',
      disabled: 'AI is turned off',
      quota: 'Usage allowance is exhausted',
      connection: 'Connection failed',
    },
  },
};
