import type { GuidedState } from '../guided-contracts';
import type { Plan, PlanVersion } from '../models';

/** Only explicit generation ownership establishes a batch. Dates/names are not identities. */
export function legacyPlanGroups(plans: readonly Plan[], versions: readonly PlanVersion[], states: readonly GuidedState[]) {
  const active = new Map(plans.filter(p => p.model === 'date-day' && p.status === 'active' && !p.deletedAt).map(p => [p.id, p]));
  const groups = new Map<string, string[]>();
  const assign = (key: string, ids: string[]) => {
    const members = [...new Set(ids)].filter(id => active.has(id)).sort();
    if (members.length > 1) groups.set(key, members);
  };
  for (const state of states) {
    for (const program of state.programs) if (program.candidateId && program.status !== 'terminated') assign(`candidate:${program.candidateId}`, program.planIds);
    for (const event of state.events) if (event.action === 'created' && event.after?.startsWith('independent-candidate:') && event.reason) {
      try { const ids: unknown = JSON.parse(event.reason); if (Array.isArray(ids) && ids.every(id => typeof id === 'string')) assign(event.after, ids); } catch { /* Unverifiable ownership stays separate. */ }
    }
  }
  const requests = new Map<string, string[]>();
  for (const plan of active.values()) {
    const request = versions.find(v => v.id === plan.currentVersionId)?.generationMetadata?.requestId;
    if (request) requests.set(request, [...requests.get(request) ?? [], plan.id]);
  }
  for (const [id, ids] of requests) assign(`request:${id}`, ids);
  // Conflicting evidence must never cause a transitive merge of unrelated batches.
  const memberships = new Map<string, Set<string>>();
  for (const ids of groups.values()) for (const id of ids) memberships.set(id, new Set([...(memberships.get(id) ?? []), ids.join('|')]));
  const unique = new Map<string, string[]>();
  for (const ids of groups.values()) if (ids.every(id => memberships.get(id)?.size === 1)) unique.set(ids.join('|'), ids);
  const grouped = new Set([...unique.values()].flat());
  return [...unique.values(), ...plans.filter(p => !p.deletedAt && !grouped.has(p.id)).map(p => [p.id])];
}

export function dateWeeklyTarget(dates: readonly string[]) {
  const unique = [...new Set(dates)].sort();
  if (!unique.length) return 1;
  const days = (Date.parse(`${unique.at(-1)}T00:00:00Z`) - Date.parse(`${unique[0]}T00:00:00Z`)) / 86400000 + 1;
  const weeks = Math.max(1, Math.ceil(days / 7));
  return Math.max(1, Math.min(7, Math.round(unique.length / weeks)));
}
