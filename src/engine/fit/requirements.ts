import { type SessionDraft, type PipelineContext } from '../contracts';
import { condition } from '../data';
import { sourceCorePatternGroups } from '../skeleton';

/** Preserve an already represented source requirement; absence never becomes a fabricated success. */
export function retainsRequirements(
  before: Pick<SessionDraft, 'items'>,
  after: Pick<SessionDraft, 'items'>,
  ctx: PipelineContext,
): boolean {
  const r = ctx.rules,
    balance = (t: Pick<SessionDraft, 'items'>) =>
      t.items.some(
        i => r.byExercise.get(i.exerciseId)?.primary_pattern === 'balance' && i.prescription?.block !== 'cooldown',
      );
  if (
    (ctx.gate.restrictions.population === 'older_adult' ||
      (ctx.profile.population.kind === 'pregnant' &&
        ctx.profile.sessionMinutes > r.get('session.durations.allowed').minutes[0] &&
        condition(r.get('pregnancy.exclude.fall_risk').restore_slot.when, r.data.exercises[0], {
          gestation_week: ctx.profile.population.week,
        }))) &&
    balance(before) &&
    !balance(after)
  )
    return false;
  const source = r.get('week.coverage.patterns');
  const prior = ctx.plan?.templates.filter(t => t.id !== (before as SessionDraft).id).flatMap(t => t.items) ?? [];
  const patterns = (items: SessionDraft['items']) =>
    new Set(
      items
        .filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
        .flatMap(i => {
          const e = r.byExercise.get(i.exerciseId);
          return e ? [e.primary_pattern] : [];
        }),
    );
  const a = patterns([...prior, ...before.items]),
    b = patterns([...prior, ...after.items]);
  for (const entry of Object.values(source.weekly_min_exposures))
    for (const group of Array.isArray(entry) ? entry.map(p => [p]) : [(entry as { patterns: string[] }).patterns])
      if (group.some((p: string) => a.has(p as never)) && !group.some((p: string) => b.has(p as never))) return false;
  const core = r.get('balance.week.core_three'),
    groups = [
      ...(core.rt_days_min_3.required_each ?? []),
      ...(core.rt_days_1_2.required ?? []),
      ...(core.rt_days_1_2.required_one_of ?? []),
    ];
  if (
    groups.some((pattern: string) => a.has(pattern as never)) &&
    !groups.some((pattern: string) => b.has(pattern as never))
  )
    return false;
  const work = (items: SessionDraft['items']) =>
      items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')),
    rtDays = [...(ctx.plan?.templates.filter(t => t.id !== (before as SessionDraft).id) ?? []), before].filter(
      t => work(t.items).length,
    ).length,
    seen = (items: SessionDraft['items']) =>
      new Set(
        work(items).flatMap(i => {
          const e = r.byExercise.get(i.exerciseId);
          return e ? [e.primary_pattern, ...(core.count_secondary_patterns ? e.secondary_patterns : [])] : [];
        }),
      ),
    ca = seen([...prior, ...before.items]),
    cb = seen([...prior, ...after.items]);
  for (const group of sourceCorePatternGroups(rtDays, r))
    if (group.some(pattern => ca.has(pattern)) && !group.some(pattern => cb.has(pattern))) return false;
  return true;
}
