import type { AdminContext, AdminTodo, TodoSource } from './contracts';
export function createTodoRegistry<C = AdminContext>() {
  const sources = new Map<string, TodoSource<C>>();
  return {
    registerTodoSource(source: TodoSource<C>) {
      if (sources.has(source.id)) throw new Error('DUPLICATE_TODO_SOURCE');
      sources.set(source.id, source);
      return () => sources.delete(source.id);
    },
    async evaluate(context: C): Promise<AdminTodo[]> {
      const levels = { alert: 0, warn: 1, info: 2 };
      const items = (await Promise.all([...sources.values()].map(s => s.evaluate(context)))).flat();
      if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('DUPLICATE_TODO_ID');
      return items.sort((a, b) => levels[a.level] - levels[b.level] || a.id.localeCompare(b.id));
    },
  };
}
const registry = createTodoRegistry();
export const registerTodoSource = registry.registerTodoSource;
export const evaluateTodos = registry.evaluate;
