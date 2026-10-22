import { useState } from 'react';
import type { AdminTodo } from '../../../backend/admin/core/contracts';
import { adminRequest } from '../shared/api';
import { budgetDismissKey, dismissBudgetReminder, dismissibleBudgetMonth } from './budget-dismiss';
export function BudgetDismissButton({
  todo,
  language,
  onDismissed,
}: {
  todo: AdminTodo;
  language: 'zh' | 'en';
  onDismissed: () => void;
}) {
  const month = dismissibleBudgetMonth(todo),
    zh = language === 'zh';
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [retry, setRetry] = useState(() => {
      try {
        return !!month && !!sessionStorage.getItem(budgetDismissKey(month));
      } catch {
        return false;
      }
    }),
    [message, setMessage] = useState('');
  if (!month || done) return null;
  async function dismiss() {
    setBusy(true);
    try {
      await dismissBudgetReminder(todo, sessionStorage, (month, id) =>
        adminRequest('finance/dismiss-budget', { month }, id),
      );
      setDone(true);
      onDismissed();
    } catch {
      setRetry(true);
      setMessage(zh ? '关闭结果尚未确认，请重试同一次。' : 'Dismissal is not confirmed. Retry the same request.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button disabled={busy} onClick={() => void dismiss()}>
        {retry
          ? zh
            ? '重试关闭同一提醒'
            : 'Retry this dismissal'
          : zh
            ? '关闭本月 50% 提醒'
            : 'Dismiss monthly 50% reminder'}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
