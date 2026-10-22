import type { Change, EngineProfile, EngineResult } from '../contracts';
import type { SessionTemplate } from '../../domain/v8/contracts';
import { Rules, stableString } from '../data';

import { createContext } from '../pipeline';

export function changes(before: SessionTemplate, after: SessionTemplate): Change[] {
  const result: Change[] = [];
  for (let n = 0; n < Math.max(before.items.length, after.items.length); n++) {
    const a = before.items[n],
      b = after.items[n];
    if (stableString(a) !== stableString(b))
      result.push({
        kind: !a ? 'add' : !b ? 'remove' : a.exerciseId !== b.exerciseId ? 'replace' : 'volume',
        templateId: before.id,
        itemIndex: n,
        before: a,
        after: b,
      });
  }
  if (before.estimatedMinutes !== after.estimatedMinutes)
    result.push({
      kind: 'duration',
      templateId: before.id,
      before: before.estimatedMinutes,
      after: after.estimatedMinutes,
    });
  return result;
}
export function result<T>(value: T, diff: Change[], r: Rules, p: EngineProfile, minutes?: number): EngineResult<T> {
  const ctx = createContext(p, 0, r),
    labels: { zh: string; en: string }[] = [];
  for (const [kind, key] of [
    ['replace', 'replace'],
    ['remove', 'remove'],
    ['add', 'add'],
    ['volume', 'volume'],
    ['frequency', 'volume'],
  ] as const) {
    const count = diff.filter(d => d.kind === kind).length;
    if (count) labels.push(r.text(`meta.copy.operation_${key}`, { count }));
  }
  if (minutes !== undefined && diff.length) labels.push(r.text('meta.copy.operation_duration', { minutes }));
  return {
    value,
    diff,
    summary: {
      zh: labels.map(l => l.zh).join(' · '),
      en: labels.map(l => l.en).join(' · '),
    },
    trace: ctx.trace,
    noop: !diff.length,
    notices: ctx.gate.notices,
    gates: ctx.gate.reasons,
  };
}
