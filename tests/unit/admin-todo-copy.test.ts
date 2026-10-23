import { describe, expect, it } from 'vitest';
import { todoInLanguage } from '../../src/ui/admin/todos/copy';
import { financeTodos } from '../../src/backend/admin/finance/report';

describe('console to-dos follow the console language', () => {
  it('translates known keys and keeps the server text in Chinese', () => {
    const [todo] = financeTodos(6000, 0, 10000, '2026-10');
    expect(todoInLanguage(todo, 'zh').title).toBe(todo.title);
    expect(todoInLanguage(todo, 'zh').actions[0].label).toBe(todo.actions[0].label);
    expect(todoInLanguage(todo, 'en').title).toBe('Monthly budget 60% used (¥60.00 / ¥100.00)');
    expect(todoInLanguage(todo, 'en').actions[0].label).toBe('View costs');
  });
  it('falls back to the server text for an unknown key', () => {
    const todo = {
      id: 'x',
      level: 'info' as const,
      title: '新事项',
      text: '说明',
      actions: [{ label: '去看', href: '/admin' }],
    };
    expect(todoInLanguage(todo, 'en')).toEqual(todo);
  });
});
