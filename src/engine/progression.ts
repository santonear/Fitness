import { offerScheduledDeload } from './progression/schedule';
import { removeDroppedPatterns } from './progression/finalize';
import { facts, events } from './progression/feedback';
import { repBounds } from './progression/load-step';
import { confirmedPainReplacements } from './progression/confirmed-pain';
import { finishProgression } from './progression/finalize';
import { progressionFatigue } from './progression/fatigue';
import { createItemActions } from './progression/item-actions';
import { applyRecoveryGuards } from './progression/recovery-guards';
import { derivePostpartumRisk, postpartumMuscleSets } from './postpartum-risk';
import {
  type EngineCheckin,
  type EnginePlan,
  type EngineProfile,
  type ProgressionResult,
  type RuleTrace,
} from './contracts';
import type { WorkoutRecord } from '../domain/v8/contracts';
import { elapsedDays, detrainingGapDays, Rules, stableString } from './data';
import { effectiveGoalRole, newWeek, type Item } from './dose';
import { result, substituteItem } from './operations';
import { runGates } from './gates';
import { createContext } from './pipeline';

export function progress(
  history: WorkoutRecord[],
  plan: EnginePlan,
  p: EngineProfile,
  r: Rules,
  options?: { checkin?: EngineCheckin; templateId?: string },
): ProgressionResult {
  const value = structuredClone(plan);
  const output: ProgressionResult = {
    ...result(value, [], r, p),
    suggestions: [],
  };
  const gate = runGates(p, r),
    s = gate.restrictions;
  if (s.blocked || !p.asOfDate) return output;
  const confirmed = confirmedPainReplacements(history, value, p, r, s, output);
  const finish = () => finishProgression(value, output, p, r, plan);
  const completed = [...new Map(history.map(h => [h.id, h])).values()]
    .filter(
      h =>
        (h.status === 'complete' || h.status === 'partial') &&
        h.endedAt &&
        Date.parse(h.localDate) <= Date.parse(p.asOfDate!),
    )
    .sort(
      (a, b) =>
        a.localDate.localeCompare(b.localDate) || a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
    );
  if (!completed.length && !options?.checkin) return finish();
  const latest = completed.at(-1);
  const gap = latest ? elapsedDays(latest.localDate, p.asOfDate) : 0;
  const classification = r.get('progression.return.classify');
  const returning = gap > detrainingGapDays(p, r);
  const { fatigue, flags, current } = progressionFatigue(completed, options, p, r, output);
  const deload = flags >= fatigue.min_flags;
  const trace: RuleTrace[] = output.trace;
  const droppedPatterns = new Set<string>();
  const postpartumRisk = derivePostpartumRisk(p, r).applies,
    postpartumBaseline = postpartumRisk ? postpartumMuscleSets(plan, r) : undefined;
  if (postpartumRisk)
    r.trace(output.trace, 'postpartum.risk_modifiers', 'source_lower_bound_for_known_or_unknown_modifiers');
  const schedule = offerScheduledDeload(completed, p, r, trace);
  for (const t of value.templates)
    for (const [index, raw] of t.items.entries()) {
      if (confirmed.protectedItems.has(raw)) continue;
      const before = structuredClone(raw) as Item;
      const item = raw as Item;
      const e = r.byExercise.get(item.exerciseId);
      if (!e || !['strength', 'isometric', 'power'].includes(e.modality)) continue;
      const recordFacts = (record: WorkoutRecord) => {
        const all = facts(record, e.id);
        if (record.templateId === t.id) return all.filter(f => f.itemIndex === index);
        return new Set(all.map(f => f.itemIndex)).size === 1 ? all : [];
      };
      const records = completed.filter(h => recordFacts(h).length).slice(-2);
      if (!records.length && !deload) continue;
      const last = records.at(-1);
      const sets = last ? recordFacts(last) : [];
      const activeIndexes = new Set(sets.map(f => f.itemIndex));
      const feedback = last ? events(last, e.id).filter(event => activeIndexes.has(event.itemIndex)) : [];
      const lastFeedback = feedback.at(-1);
      const role = effectiveGoalRole(item, p, r);
      const [repMin, repMax] = repBounds(e, p, r, role);
      let ruleId = '';
      if (last && feedback.some(event => confirmed.handledEvents.has(`${last.id}:${event.id}`))) continue;
      const { setLoad, ladder } = createItemActions(
        e,
        p,
        r,
        gate,
        s,
        role,
        item,
        sets,
        feedback,
        repMin,
        repMax,
        trace,
      );
      const pain = feedback.find(
        f => (f.painScore ?? 0) >= r.get('pain.rule').bands[1].when.all[0].gte || f.effort === 'discomfort',
      );
      if (pain) {
        ruleId = 'progression.feedback.pain';
        const drop = (pain.painScore ?? 0) > r.get('pain.rule').bands[1].when.all[1].lte;
        r.notice(output.notices, drop ? 'pain.copy.drop_pattern' : 'pain.copy.stop_exercise', 'warning');
        if (drop) {
          droppedPatterns.add(e.primary_pattern);
          r.trace(trace, 'pain.rule', 'pattern_removed_due_to_recorded_pain', {
            pattern: e.primary_pattern,
          });
          continue;
        }
        // The swap avoids this session's other exercises and the neighbouring days', like a swap made on the plan.
        const swap = createContext(p, 0, r);
        swap.plan = value;
        swap.currentWeekday = t.weekday;
        const others = t.items.filter(other => other !== raw);
        swap.usedIds = new Set(others.map(other => other.exerciseId));
        // …and their ladders: a ladder sibling is the same movement for variety.no_repeat.
        swap.usedLadders = new Set(others.flatMap(other => r.byExercise.get(other.exerciseId)?.ladder.id || []));
        const replacement = substituteItem(item, p, 'pain', r, swap);
        if (!replacement.noop) Object.assign(item, replacement.value);
        else continue;
      } else if (lastFeedback?.effort === 'too_hard') {
        ruleId = 'progression.feedback.too_hard';
        const setsBefore = item.sets;
        if (!setLoad(r.get(ruleId).loadable.next_session_load_pct) && !ladder(-1)) {
          // One set fewer, once: a ladder with no easier step already took it.
          if (item.sets === setsBefore) item.sets = Math.max(1, item.sets - 1);
          if ('reps' in item.target) item.target.reps = repMin;
        }
      } else if (returning) {
        const thresholds = p.population.kind === 'older_adult' ? r.get('older.return_after_break') : undefined;
        const weeks = gap / 7;
        const short = thresholds?.returning_short_weeks_max ?? classification.classes.returning_short.gap_weeks_max;
        const mid = thresholds?.returning_mid_weeks.max ?? classification.classes.returning_mid.gap_weeks_max;
        const kind = weeks <= short ? 'short' : weeks <= mid ? 'mid' : 'long';
        ruleId = `progression.return.${kind}`;
        const v = r.get(ruleId);
        const load = kind === 'short' ? v.week_1.load_pct : kind === 'mid' ? v.load_pct_by_week[0] : v.start.load_pct;
        const count =
          kind === 'short' ? v.week_1.volume_pct : kind === 'mid' ? v.volume_pct_by_week[0] : v.start.volume_pct;
        if (item.target.metricType === 'reps_load') {
          const recorded = sets.filter(f => (f.loadGrams ?? 0) > 0).map(f => f.loadGrams!);
          if (recorded.length) item.target.loadGrams = Math.floor((Math.max(...recorded) * load) / 100);
          else continue;
        } else if (kind !== 'short') ladder(-1);
        const previousSets = sets.length;
        item.sets = Math.max(1, Math.min(previousSets - 1, Math.floor((previousSets * count) / 100)));
        if ('reps' in item.target) item.target.reps = repMin;
        if (item.prescription)
          item.prescription.rir = [
            Math.max(item.prescription.rir[0], r.get('progression.return.bodyweight').first_session_rir_min),
            Math.max(item.prescription.rir[1], r.get('progression.return.bodyweight').first_session_rir_min),
          ];
      } else if (
        deload &&
        (p.level !== 'beginner' ||
          p.trainingAgeWeeks >= schedule.new_user_no_scheduled_first_training_weeks ||
          t.id === (options?.templateId ?? value.templates[0]?.id))
      ) {
        ruleId = 'deload.dose.prescription';
        const v = r.get(ruleId);
        const introduction =
          p.level === 'beginner' && p.trainingAgeWeeks < schedule.new_user_no_scheduled_first_training_weeks;
        const reduction = introduction
          ? v.set_reduction_pct.moderate
          : flags >= fatigue.heavy_when_flags_gte
            ? v.set_reduction_pct.heavy
            : v.set_reduction_pct.moderate;
        item.sets = Math.max(v.min_sets_per_exercise, Math.floor((item.sets * (100 - reduction)) / 100));
        if (item.prescription)
          item.prescription.rir = [
            Math.max(v.rir_min, item.prescription.rir[0]),
            Math.max(v.rir_min, item.prescription.rir[1]),
          ];
        if (introduction)
          r.trace(trace, 'deload.new_user.easy_days', 'next_session_only_with_extra_rest_day', {
            extraRestDays: r.get('deload.new_user.easy_days').extra_rest_days_before_next_session,
          });
      } else if (lastFeedback?.effort === 'too_light') {
        ruleId = 'progression.feedback.too_easy';
        if (!setLoad(r.get(ruleId).loadable.next_session_load_pct)) {
          if ('reps' in item.target && item.target.reps < r.get('dose.reps.bounds').absolute_max) {
            ruleId = 'progression.fixed_load.order';
            item.target.reps++;
          } else ladder(1);
        }
      } else if (
        records.length === 2 &&
        records.every(h => recordFacts(h).some(set => (set.reps ?? Infinity) < repMin))
      ) {
        ruleId = 'progression.stall.reset';
        if (!setLoad(r.get(ruleId).load_change_pct)) ladder(-1);
      } else if (lastFeedback?.rir !== undefined && item.prescription) {
        const logged = lastFeedback.rir,
          [min, max] = item.prescription.rir;
        const deviation = logged > max ? logged - max : logged < min ? logged - min : 0;
        const smallIgnored =
          newWeek(p, r) &&
          Math.abs(deviation) <= r.get('progression.autoreg.input').new_user_weeks_1_4.ignore_abs_deviation_lte;
        const v = r
          .get('progression.autoreg.rir')
          .next_session_load_change_pct.find(
            (v: { deviation_gte?: number; deviation_lte?: number; deviation_eq?: number }) =>
              v.deviation_gte !== undefined
                ? deviation >= v.deviation_gte
                : v.deviation_lte !== undefined
                  ? deviation <= v.deviation_lte
                  : deviation === v.deviation_eq,
          );
        if (!smallIgnored && v && (!newWeek(p, r) || v.pct < 0)) {
          ruleId = 'progression.autoreg.rir';
          setLoad(v.pct);
        }
      }
      if (!ruleId) {
        const trigger = r.get('progression.double.trigger');
        const count =
          p.level === 'beginner' && p.trainingAgeWeeks >= trigger.fast_track.from_week - 1
            ? trigger.fast_track.consecutive_sessions
            : trigger.consecutive_sessions;
        const reached =
          records.length >= count &&
          records.slice(-count).every(h => {
            const fs = recordFacts(h),
              fb = events(h, e.id);
            return (
              fs.length >= item.sets &&
              fs.every(f => (f.reps ?? 0) >= repMax) &&
              fs.every(f => {
                const ev = fb.find(v => v.itemIndex === f.itemIndex && v.setIndex === f.setIndex);
                return ev?.rir !== undefined && ev.rir >= (item.prescription?.rir[0] ?? 0);
              })
            );
          });
        if (reached) {
          ruleId = 'progression.double.trigger';
          const increment = r.get('progression.load.increment');
          const lower = increment.lower_compound.match.primary_pattern.includes(e.primary_pattern);
          if (!setLoad(lower ? increment.lower_compound.pct : increment.upper_compound.pct)) ladder(1);
        } else if ('durationSeconds' in item.target && e.modality === 'isometric') {
          const duration = item.target.durationSeconds;
          if (sets.every(f => (f.durationSeconds ?? 0) >= duration)) {
            ruleId = 'dose.isometric';
            const v = r.get(ruleId);
            // Never past this level's hold range (beginner 30 s), the same bound the hard check uses.
            const cap = Math.min(v.hold_s_max, v[p.level]?.hold_s?.[1] ?? v.hold_s_max);
            item.target.durationSeconds = Math.min(cap, duration + v.progression.add_s_per_session);
          }
        }
      }
      ruleId = applyRecoveryGuards(
        p,
        r,
        e,
        s,
        completed,
        item,
        before,
        current,
        postpartumRisk,
        postpartumBaseline,
        value,
        trace,
        ruleId,
      );
      if (ruleId && stableString(before) !== stableString(item)) {
        r.trace(trace, ruleId, 'next_target_selected', { exerciseId: e.id });
        const change = {
          kind: 'volume' as const,
          templateId: t.id,
          itemIndex: index,
          before,
          after: structuredClone(item),
        };
        output.diff.push(change);
        const summary = r.text('meta.copy.progression_adjusted');
        r.trace(trace, 'meta.copy.progression_adjusted', 'progression_summary_copy');
        output.suggestions.push({
          templateId: t.id,
          itemIndex: index,
          before,
          after: structuredClone(item),
          ruleId,
          summary,
        });
      }
    }
  removeDroppedPatterns(value, droppedPatterns, r, output);
  return finish();
}
