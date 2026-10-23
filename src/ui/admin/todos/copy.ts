import type { AdminTodo } from '../../../backend/admin/core/contracts';
import { fill } from '../../../i18n/features/onboarding/entry';

/** Console to-do copy by the stable key the server sends; zh matches the server's fallback text. */
const todoCopy = {
  zh: {
    errorSpike: ['生产错误增加', '最近一小时出现 {count} 次 {type} 错误。'],
    applicationsOverdue: ['申请等待超过两天', '{count} 份申请等待审核。'],
    applicationsPending: ['新申请', '{count} 份申请等待审核'],
    ledgerPending: ['账本需要核对', '有 {count} 笔调用等待按供应商账单核算。调用是否可用以当前准入状态为准。'],
    ledgerFlagged: ['账本需要核对', '账本标记为需要核对。请检查供应商账单和现有费用记录。'],
    budgetUsed: [
      '本月预算已用 {percent}%（¥{spent} / ¥{budget}）',
      '包含已核算费用与待核算预留；不改变当前调用准入规则。',
    ],
    sensitivePending: ['敏感开关等待确认', '{name} 尚未开启，请核对影响。'],
    smokePreview: ['发布检查需要处理', '预览 有 {count} 项检查未通过或暂不可用。'],
    smokeProduction: ['发布检查需要处理', '生产 有 {count} 项检查未通过或暂不可用。'],
  },
  en: {
    errorSpike: ['Production errors increased', '{count} {type} errors in the last hour.'],
    applicationsOverdue: ['Applications waiting over two days', '{count} applications are waiting for review.'],
    applicationsPending: ['New applications', '{count} applications are waiting for review'],
    ledgerPending: [
      'Ledger needs reconciling',
      '{count} calls are waiting to be reconciled against the provider bill. Whether calls are allowed follows the current admission state.',
    ],
    ledgerFlagged: [
      'Ledger needs reconciling',
      'The ledger is marked for reconciliation. Check the provider bill and existing cost records.',
    ],
    budgetUsed: [
      'Monthly budget {percent}% used (¥{spent} / ¥{budget})',
      'Includes settled costs and pending reservations; current admission rules are unchanged.',
    ],
    sensitivePending: ['Sensitive switch awaiting confirmation', '{name} is not on yet. Check its impact.'],
    smokePreview: ['Release checks need attention', '{count} checks in preview failed or are unavailable.'],
    smokeProduction: ['Release checks need attention', '{count} checks in production failed or are unavailable.'],
  },
} satisfies Record<'zh' | 'en', Record<string, readonly [string, string]>>;
const actionCopy = {
  zh: {
    viewErrors: '查看错误',
    reviewEach: '逐个审核',
    reconcile: '逐笔核对',
    viewCosts: '查看费用',
    reviewConfirm: '查看并确认',
    viewReleases: '查看发布',
  },
  en: {
    viewErrors: 'View errors',
    reviewEach: 'Review one by one',
    reconcile: 'Reconcile each',
    viewCosts: 'View costs',
    reviewConfirm: 'Review and confirm',
    viewReleases: 'View releases',
  },
} satisfies Record<'zh' | 'en', Record<string, string>>;

/** A to-do in the console language; unknown keys (older servers) keep the server's text. */
export function todoInLanguage(todo: AdminTodo, language: 'zh' | 'en'): AdminTodo {
  const words = todo.key ? (todoCopy[language] as Record<string, readonly [string, string]>)[todo.key] : undefined,
    labels = actionCopy[language] as Record<string, string>;
  return {
    ...todo,
    title: words ? fill(words[0], todo.params ?? {}) : todo.title,
    text: words ? fill(words[1], todo.params ?? {}) : todo.text,
    actions: todo.actions.map(action => ({ ...action, label: (action.key && labels[action.key]) || action.label })),
  };
}
