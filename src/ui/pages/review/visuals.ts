import { itemRegion, type BodyRegion } from '../../../application/plan-presentation';
import type { ChartPoint } from '../../../application/review/charts';

/** Read-only projections for the visual review. Nothing here is stored or sent. */
export interface RegionShare { region: BodyRegion; sets: number; share: number }

/** Saved sets per body region (engine pattern first, catalog body part as fallback), largest first. */
export function regionShares(rows: readonly { sets: readonly { exerciseId: string }[] }[], limit = 5): RegionShare[] {
  const counts = new Map<BodyRegion, number>();
  for (const row of rows) for (const set of row.sets) {
    const region = itemRegion({ exerciseId: set.exerciseId });
    if (region) counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([region, sets]) => ({ region, sets, share: total ? sets / total : 0 }));
}

/** Buckets (days or weeks) with at least one session that moved. */
export const activeBuckets = (points: readonly ChartPoint[]) => points.filter(point => point.sessions > 0).length;

/** `MM/DD` for compact date chips. */
export const shortDate = (date: string) => date.slice(5).replace('-', '/');

export interface SetLine { exerciseId: string; text: string; note?: string }
/**
 * Consecutive sets of one exercise become one line: identical sets read "2 × 10 次 · 8 公斤",
 * different ones are joined with " / ". Every set note stays visible next to its set.
 */
export function groupSets(sets: readonly SetLine[]): { exerciseId: string; text: string }[] {
  const groups: { exerciseId: string; sets: SetLine[] }[] = [];
  for (const set of sets) {
    const last = groups.at(-1);
    if (last && last.exerciseId === set.exerciseId) last.sets.push(set); else groups.push({ exerciseId: set.exerciseId, sets: [set] });
  }
  return groups.map(group => {
    const same = group.sets.length > 1 && group.sets.every(set => set.text === group.sets[0].text && !set.note);
    const text = same ? `${group.sets.length} × ${group.sets[0].text}` : group.sets.map(set => set.note ? `${set.text} · ${set.note}` : set.text).join(' / ');
    return { exerciseId: group.exerciseId, text };
  });
}
