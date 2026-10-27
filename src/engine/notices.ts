import { checkHard } from './hard-checks';
import { estimatedSeconds } from './fit/elapsed-time';
import type { EngineNotice, GateOutcome, PipelineContext, ScoreResult } from './contracts';
import { volume, volumeLimits } from './dose';
/** Only registered, semantically applicable copy reaches the UI. */
export function buildNotices(score: ScoreResult, gate: GateOutcome, ctx: PipelineContext): EngineNotice[] {
  const candidates: { notice: EngineNotice; impact: number }[] = gate.notices.map(notice => ({
    notice,
    impact: notice.severity === 'stop' ? Infinity : notice.severity === 'warning' ? 100 : 1,
  }));
  const add = (key: string, impact: number) => {
    const copy = ctx.rules.data.copy[key];
    if (!copy || /\{[^}]+\}/.test(copy.zh + copy.en)) return;
    candidates.push({
      impact,
      notice: {
        code: key,
        ruleId: copy.sourceRuleId,
        copyPath: copy.path,
        severity: 'info',
        message: { zh: copy.zh, en: copy.en },
      },
    });
  };
  if (
    ctx.plan &&
    checkHard(ctx.plan, ctx.profile, ctx.gate, ctx.rules).some(issue => issue.code === 'intentional_short')
  )
    add('session.copy.intentional_short', 99);
  const plan = ctx.plan,
    items = plan?.templates.flatMap(t => t.items) ?? [],
    owned = new Set(['none', 'yoga-mat-optional', ...(ctx.profile?.equipment ?? [])]),
    available = (e: (typeof ctx.rules.data.exercises)[number]) =>
      e.equipment_required.every(
        req => owned.has(req) || (e.equipment_alternatives[req] ?? []).some(alt => owned.has(alt)),
      );
  const longSession = ctx.rules.get('pregnancy.copy.long_session');
  if (
    ctx.profile?.population.kind === 'pregnant' &&
    plan?.templates.some(t => estimatedSeconds(t, ctx.rules) > longSession.when_minutes_gt * 60)
  )
    add('pregnancy.copy.long_session.copy', 50);
  const actualPatterns = new Set<string | undefined>(
    items
      .filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
      .map(i => ctx.rules.byExercise.get(i.exerciseId)?.primary_pattern),
  );
  const equipmentLimited =
    plan &&
    ctx.rules
      .get('week.coverage.patterns')
      .weekly_min_exposures.each_once.some(
        (pattern: string) =>
          !actualPatterns.has(pattern) &&
          !ctx.rules.data.exercises.some(e => e.primary_pattern === pattern && available(e)),
      );
  for (const item of score.perRule) {
    const impact = (1 - item.satisfaction) * item.weight;
    if (impact <= 0) continue;
    let key: string | undefined;
    if (
      [
        'dose.sets_week.beginner',
        'dose.sets_week.intermediate',
        'dose.sets_week.goal_matrix',
        'progression.new.weekly_sets',
        'goal.floor.all',
      ].includes(item.id) &&
      plan
    ) {
      // A yoga plan does not aim at muscle volume, so it is not told that parts are trained too little.
      if (ctx.profile?.goal === 'yoga') continue;
      const sets = volume(
          items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')),
          ctx.rules,
        ),
        min = volumeLimits(ctx.profile, ctx.rules).min;
      if (ctx.rules.get('dose.muscle_groups').target_groups.some((g: string) => (sets[g] ?? 0) < min))
        key = 'engine.copy.target_volume';
    }
    if (
      [
        'goal.aerobic.baseline',
        'aerobic.target.weekly',
        'older.week.aerobic',
        'pregnancy.week.target',
        'postpartum.weekly_target',
      ].includes(item.id) &&
      plan &&
      score.perRule.some(r => r.id === 'aerobic.target.weekly' && r.satisfaction < 1)
    )
      key = 'engine.copy.target_aerobic';
    if (item.id === 'week.coverage.patterns' && equipmentLimited) key = 'engine.copy.target_coverage';
    if (item.id === 'week.recovery.spacing') key = 'engine.copy.target_spacing';
    if (item.id === 'session.cooldown.stretch') key = 'session.copy.short_stretch_target';
    if (key) add(key, impact);
    else {
      const registered = Object.entries(ctx.rules.data.copy).find(([, copy]) => copy.sourceRuleId === item.id);
      if (registered) add(registered[0], impact);
    }
  }
  if (
    ctx.profile?.population.kind === 'older_adult' &&
    ctx.profile.daysPerWeek <
      ctx.rules.get('older.template.balance_required').target_balance_per_session_when_days_below
  )
    add('engine.copy.target_balance', 1);
  for (const advice of score.advice.filter(r => !r.satisfied)) {
    if (
      advice.id === 'equipment.pull_gap' &&
      plan &&
      !ctx.rules.data.exercises.some(
        e => ['pull_horizontal', 'pull_vertical'].includes(e.primary_pattern) && available(e),
      )
    )
      add('equipment.pull_gap_copy', ctx.rules.byId.get(advice.id)?.weight ?? 1);
    else {
      const registered = Object.entries(ctx.rules.data.copy).find(([, copy]) => copy.sourceRuleId === advice.id);
      if (registered) add(registered[0], ctx.rules.byId.get(advice.id)?.weight ?? 1);
    }
  }
  const seen = new Set<string>();
  const priority = (notice: EngineNotice) =>
    notice.severity === 'stop' || notice.code === 'pregnancy.stop.copy.stop'
      ? 3
      : notice.code.startsWith('engine.copy.environment_')
        ? 2
        : notice.code === 'pregnancy.copy.long_session.copy'
          ? 1
          : 0;
  return candidates
    .sort(
      (a, b) =>
        priority(b.notice) - priority(a.notice) ||
        b.impact - a.impact ||
        a.notice.ruleId.localeCompare(b.notice.ruleId),
    )
    .filter(({ notice }) => {
      if (seen.has(notice.ruleId)) return false;
      seen.add(notice.ruleId);
      return true;
    })
    .slice(0, 3)
    .map(x => x.notice);
}
