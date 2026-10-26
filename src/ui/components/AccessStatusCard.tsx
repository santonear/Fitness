import { accessCopy, accessReason } from '../../application/ai-access';
import { aiActivationCopy } from '../../i18n/features/coach/activation';
import { fill } from '../../i18n/features/onboarding/entry';
import { useAccessStatus } from '../useAccessStatus';

/** One line for 我的 › AI 助手芽芽 (V9.22): not on / on until … / used up today / paused. */
export function useAiStatusText(locale: 'zh' | 'en') {
  const { status, loading, failed } = useAccessStatus();
  const t = aiActivationCopy[locale].status;
  if (failed) return accessCopy[locale].reasons.connection;
  if (loading || !status) return t.checking;
  const reason = accessReason(status);
  if (reason === 'invalid') return t.none;
  if (reason === 'disabled') return t.off;
  if (reason === 'quota') return t.quota;
  return status.expiresAt
    ? fill(t.until, { date: new Date(status.expiresAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en') })
    : t.active;
}
