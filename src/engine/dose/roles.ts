import { type Item } from './types';
import { Rules } from '../data';
import { type EngineProfile, type EnginePrescription } from '../contracts';

/** Only authored literals or pipeline-generated day/slot prefixes carry source role identity. */
export function authoredPosition(item: Item, r: Rules): string | undefined {
  const raw = item.prescription?.sourcePosition;
  if (!raw) return;
  const position = /^day-[a-f0-9]{8}-[^-]+-((?:main|acc)_\d+)$/.exec(raw)?.[1] ?? raw;
  return r.data.rules.some(
    rule =>
      rule.id.startsWith('week.day.') && rule.value?.slots?.some((slot: { pos: string }) => slot.pos === position),
  )
    ? position
    : undefined;
}

/** Authored positions and the goal limit determine roles; a caller's block label cannot promote a third lift. */
export function effectiveGoalRole(item: Item, p: EngineProfile, r: Rules): EnginePrescription['block'] {
  if (p.goal !== 'strength') return item.prescription?.block ?? 'main';
  if (item.prescription?.goalRole) return item.prescription.goalRole;
  const pos = authoredPosition(item, r),
    known = pos !== undefined;
  return known && /^main_\d+$/.test(pos ?? '') ? 'main' : known ? 'accessory' : (item.prescription?.block ?? 'main');
}

export function strengthRoles(
  items: Item[],
  p: EngineProfile,
  r: Rules,
  mainCount?: number,
): Map<Item, 'main' | 'accessory'> {
  // Position resolution is pure within this call; preserve every existing filter and stable-sort order.
  const authoredPositions = new Map<Item, string | undefined>();
  const position = (item: Item) => {
    if (!authoredPositions.has(item)) authoredPositions.set(item, authoredPosition(item, r));
    return authoredPositions.get(item);
  };

  const positions = new Set(
      r.data.rules
        .filter(rule => rule.id.startsWith('week.day.'))
        .flatMap(rule => (rule.value?.slots ?? []).map((slot: { pos: string }) => slot.pos)),
    ),
    work = items.filter(
      i => ['main', 'accessory'].includes(i.prescription?.block ?? '') || positions.has(position(i) ?? ''),
    ),
    result = new Map<Item, 'main' | 'accessory'>(work.map(i => [i, 'accessory']));
  if (p.goal !== 'strength') return result;
  const limit = r.get('goal.params.strength').main_lifts_per_session,
    count = Math.max(
      limit.min,
      Math.min(
        limit.max,
        mainCount ??
          (work.some(i => i.prescription?.goalRole !== undefined)
            ? work.filter(i => i.prescription?.goalRole === 'main').length
            : limit.max),
      ),
    ),
    authored = work
      .filter(i => positions.has(position(i) ?? '') && /^main_\d+$/.test(position(i) ?? ''))
      .sort((a, b) => Number(position(a)!.slice(5)) - Number(position(b)!.slice(5))),
    legacy = work.filter(i => i.prescription?.block === 'main' && !positions.has(position(i) ?? ''));
  for (const item of [...authored, ...legacy].slice(0, count)) result.set(item, 'main');
  return result;
}
