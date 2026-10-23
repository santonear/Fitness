import type { FitnessDatabase } from './db';

type NumberedVersion = { id: string; planId: string; versionNumber: number; createdAt: string };

/** Undo moves the current pointer back, so the next number must follow the plan's highest number, not the current one. */
export async function nextVersionNumber(db: FitnessDatabase, planId: string): Promise<number> {
  const versions = await db.v8PlanVersions.where('planId').equals(planId).toArray();
  return Math.max(0, ...versions.map(version => version.versionNumber)) + 1;
}

/**
 * Repairs numbers already duplicated by the old "current + 1" rule. The earliest-created version keeps its number;
 * each later-created duplicate gets the plan's next free number in creation order. Returns only changed rows.
 */
export function renumberDuplicateVersions<T extends NumberedVersion>(versions: readonly T[]): T[] {
  const byPlan = new Map<string, T[]>();
  for (const version of versions) byPlan.set(version.planId, [...(byPlan.get(version.planId) ?? []), version]);
  return [...byPlan.values()].flatMap(rows => {
    let max = Math.max(...rows.map(row => row.versionNumber));
    const seen = new Set<number>();
    const ordered = [...rows].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.versionNumber - b.versionNumber || a.id.localeCompare(b.id),
    );
    return ordered.flatMap(row => {
      if (!seen.has(row.versionNumber)) {
        seen.add(row.versionNumber);
        return [];
      }
      return [{ ...row, versionNumber: ++max }];
    });
  });
}
