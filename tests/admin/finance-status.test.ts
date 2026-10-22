import { expect, it } from 'vitest';
import { statusCards } from '../../src/ui/admin/finance/StatusOverview';
it('uses settled plus pending for remaining budget, and hourly bins rather than all-history error count', () => {
  const cards = statusCards(
    {
      ledger: { settledFen: 1800, pendingFen: 300 },
      config: { current: { config: { monthlyBudgetFen: 3000 } } },
      todos: { items: [{ id: 'finance-ledger-reconciliation' }] },
      errors: {
        groups: [
          {
            spike: true,
            trend: [
              { time: 1, count: 4 },
              { time: 2, count: 7 },
            ],
          },
        ],
      },
    },
    'zh',
  );
  expect(cards.map(c => c.id)).toEqual(['ai', 'ledger', 'budget', 'pending', 'errors']);
  expect(cards[2].value).toBe('¥ 9.00');
  expect(cards[4].value).toBe('11');
  expect(cards[1].value).toBe('需要核对');
  expect(cards[0].value).toBe('状态不可用');
  expect(cards[1].note).not.toContain('暂停');
});
it('unavailable data is never presented as healthy zero and all five cards support English', () => {
  const unknown = statusCards({}, 'en');
  expect(unknown.every(c => c.value === 'Unavailable')).toBe(true);
  expect(JSON.stringify(unknown)).not.toMatch(/[\u4e00-\u9fff]/);
  const known = statusCards(
    {
      aiEnabled: false,
      ledger: { settledFen: 0, pendingFen: 0 },
      config: { current: { config: { monthlyBudgetFen: 3000 } } },
      todos: { items: [] },
      errors: { groups: [] },
    },
    'en',
  );
  expect(known[0].value).toBe('Off');
  expect(known[4].value).toBe('0');
  expect(known[4].note).toContain('received');
});
