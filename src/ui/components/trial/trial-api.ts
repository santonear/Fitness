import { z } from 'zod';
import { applicationSchema } from '../../../ai/trial-recovery';

export type Application = z.infer<typeof applicationSchema>;
const counts = z.object({ understand: z.number().int().nonnegative(), generate: z.number().int().nonnegative() });
const statusSchema = z.object({
  expiresAt: z.number().finite(),
  used: counts.optional(),
  limits: counts.optional(),
  period: z.string().optional(),
  pending: z.number().int().nonnegative().optional(),
  reconciliationRequired: z.boolean().optional(),
  planningReconciliationRequired: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
});
export const policyStatusSchema = statusSchema.extend({
  planningBudgetDisabled: z.boolean().optional(),
  resetAt: z.number().finite().optional(),
  timeZone: z.string().optional(),
  maxDays: z.number().int().min(1).max(14).optional(),
  maximumRequestCost: z.number().int().nonnegative().optional(),
  budgetAvailable: z.object({ understand: z.boolean(), generate: z.boolean() }).optional(),
});
export const accessStatusSchema = z.discriminatedUnion('qualification', [
  z.object({ qualification: z.literal('none'), sessionValid: z.literal(false) }),
  ...(['active', 'expired', 'revoked'] as const).map(qualification =>
    policyStatusSchema.extend({ qualification: z.literal(qualification), sessionValid: z.boolean() }),
  ),
]);
export const configSchema = z.object({ available: z.boolean(), siteKey: z.string().nullable() });
export const displayNameKey = 'fitness-trial-display-name-v1';
export async function trialApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'CONTROL_UNAVAILABLE');
  return data as T;
}
const messages: Record<string, [string, string]> = {
  APPLICATION_PENDING: [
    '已有申请正在处理，请刷新查看。',
    'An application is already being processed. Refresh its status.',
  ],
  APPLICATION_RATE_LIMIT: [
    '今天已提交申请，请保留凭证并稍后查看。',
    'An application was submitted today. Keep your receipt and check later.',
  ],
  APPLICATION_BUSY: ['当前申请较多，请稍后再试。', 'Applications are busy right now. Please try again later.'],
  APPLICATIONS_UNAVAILABLE: [
    '申请服务暂未开放，已有邀请码仍可兑换。',
    'Applications are not available yet. Existing invitation codes can still be redeemed.',
  ],
  APPLICATION_CAPACITY: ['申请队列暂满，请稍后再试。', 'The application queue is full. Please try later.'],
  VERIFICATION_REQUIRED: [
    '申请未提交：安全验证未通过。请在验证成功后再次点击“提交申请”；若仍失败，请联系管理员。',
    'Application not submitted: security verification failed. Complete the check and submit again; contact the administrator if it still fails.',
  ],
  QUALIFICATION_REQUIRED: [
    '资格已到期或不可用，请查看申请或联系管理员。',
    'Your trial has expired or is unavailable. Check your application or contact the administrator.',
  ],
  INVITE_INVALID: [
    '邀请码或领取资格已失效，请申请补发。',
    'The invitation has expired or is no longer valid. Request a replacement.',
  ],
  SUBJECT_EXPIRED: [
    '试用已到期，本地训练仍可使用。可以申请延期。',
    'Your trial has expired. Local training remains available; you can request an extension.',
  ],
  SUBJECT_NOT_FOUND: [
    '资格不可用或已撤销，本地训练数据未改变。',
    'Access is unavailable or revoked. Local training data is unchanged.',
  ],
  USE_EXTENSION: ['已有资格，请申请延期或补发。', 'You already have a trial. Request an extension or replacement.'],
};
export function accessError(reason: unknown, zh: boolean) {
  const key = reason instanceof Error ? reason.message : '';
  return (
    messages[key]?.[zh ? 0 : 1] ??
    (zh
      ? '暂时无法完成操作，状态未知。请稍后刷新，已保存训练不受影响。'
      : 'The service is unavailable; status is unknown. Refresh later. Saved training is unaffected.')
  );
}
