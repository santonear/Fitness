import { EngineProfile } from '../contracts';
import { Rules, Exercise } from '../data';
import { prescribe, Template } from '../dose';
import { safety, SafetyState } from '../gates/strength-scoring';
import { hardEligible } from './legacy-candidates';
import { setSeconds, actualWarmupSeconds } from '../fit/elapsed-time';
import { durationTier, timingRow, templateTargetMinutes, sourcePhase } from './legacy-target';
import { ensureCooldown } from './legacy-cooldown';
import { refreshWarmupRamps } from './legacy-warmup';

export function normalizeStartMovingGeneral(template: Template, p: EngineProfile, r: Rules, s: SafetyState) {
  if (p.goal !== 'start_moving' || s.phase === 1 || safetyBlockMinimums(template, p, r).applies) return;
  const general = r.get('session.warmup.general'),
    existing = template.items.find(
      i => i.prescription?.block === 'warmup' && r.byExercise.get(i.exerciseId)?.modality === 'cardio',
    );
  if (p.sessionMinutes < general.include_when.session_minutes_min) {
    template.items = template.items.filter(i => i !== existing);
    return;
  }
  const ctx = {
      profile: p,
      rules: r,
      safety: s,
      seed: 'source-general',
      trace: [],
      used: new Set<string>(),
      ladders: new Set<string>(),
    },
    e = existing
      ? r.byExercise.get(existing.exerciseId)
      : r.data.exercises
          .filter(
            e =>
              e.modality === 'cardio' &&
              e.use.includes('warmup') &&
              !general.exclude_flags.some((flag: string) => e.flags.includes(flag)) &&
              hardEligible(e, ctx),
          )
          .sort(
            (a, b) =>
              Number(a.use.includes('cooldown')) - Number(b.use.includes('cooldown')) || a.id.localeCompare(b.id, 'en'),
          )[0];
  if (!e) return;
  const seconds = general.seconds_by_duration[String(durationTier(p.sessionMinutes, p, r))],
    item = prescribe(e, p, r, s, 'warmup', 1);
  item.target = {
    metricType: e.metricType === 'duration_distance' ? 'duration_distance' : 'duration',
    durationSeconds: Math.ceil(
      (Array.isArray(seconds)
        ? Math.max(
            seconds[0],
            Math.min(
              seconds[1],
              existing && 'durationSeconds' in existing.target
                ? existing.target.durationSeconds *
                    existing.sets *
                    (existing.prescription?.perSide || e.time.per_side
                      ? r.get('session.time.model').per_side_multiplier
                      : 1)
                : seconds[1],
            ),
          )
        : seconds) / (e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1),
    ),
  };
  item.prescription!.targetRpe = general.intensity_rpe;
  if (existing) template.items[template.items.indexOf(existing)] = item;
  else template.items.unshift(item);
}

export function hasResistanceWarmupContext(template: Template, r: Rules): boolean {
  return template.items.some(item => {
    const e = r.byExercise.get(item.exerciseId);
    return e?.primary_pattern !== 'balance' && ['strength', 'isometric'].includes(e?.modality ?? '');
  });
}

export function safetyBlockMinimums(template: Template, p: EngineProfile, r: Rules) {
  const safety = r.get('safety.session.warmup_cooldown');
  const moderate = r.get('aerobic.intensity.rpe_scale').moderate[0];
  const circuit = template.items.some(item => item.prescription?.structure === 'circuit');
  const aerobic = template.items.some(
    item =>
      item.prescription?.block === 'conditioning' &&
      r.byExercise.get(item.exerciseId)?.modality === 'cardio' &&
      (item.prescription.targetRpe?.[1] ?? moderate) >= moderate,
  );
  const untargeted = p.population.kind === 'postpartum' && sourcePhase(p, r) === 1;
  const applies =
    !untargeted &&
    ((circuit && safety.applies_to_session_types.includes('circuit')) ||
      (aerobic && safety.applies_to_session_types.includes('aerobic_moderate_plus')));
  const row = timingRow(durationTier(templateTargetMinutes(template, p, r), p, r), r);
  return {
    applies,
    warmupSeconds: applies ? safety.warmup_min_minutes * 60 : 0,
    cooldownSeconds: applies ? Math.max(safety.cooldown_min_minutes, row.cooldown) * 60 : 0,
  };
}

export function ensureSafetyBlocks(template: Template, p: EngineProfile, r: Rules, s: SafetyState) {
  if (template.targetMinutes !== undefined) {
    const minutes = templateTargetMinutes(template, p, r),
      timed = { ...template, targetMinutes: undefined };
    ensureSafetyBlocks(timed, { ...p, sessionMinutes: minutes }, r, s);
    template.items = timed.items;
    return;
  }
  refreshWarmupRamps(template, p, r);
  normalizeStartMovingGeneral(template, p, r, s);
  ensureCooldown(template, p, r, s);
  const minimum = safetyBlockMinimums(template, p, r);
  if (!minimum.applies) {
    if (hasResistanceWarmupContext(template, r)) {
      const range = r.get('session.warmup.general').seconds_by_duration[String(durationTier(p.sessionMinutes, p, r))];
      if (range === 0)
        template.items = template.items.filter(
          i => !(i.prescription?.block === 'warmup' && r.byExercise.get(i.exerciseId)?.modality === 'cardio'),
        );
      else if (Array.isArray(range))
        for (const item of template.items) {
          const e = r.byExercise.get(item.exerciseId);
          if (item.prescription?.block === 'warmup' && e?.modality === 'cardio' && 'durationSeconds' in item.target) {
            const side =
              item.prescription.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
            item.target.durationSeconds = Math.max(
              1,
              Math.ceil(
                Math.max(range[0], Math.min(range[1], item.target.durationSeconds * item.sets * side)) /
                  (item.sets * side),
              ),
            );
          }
        }
    }
    return;
  }
  const ctx = {
      profile: p,
      rules: r,
      safety: s,
      seed: 'safety-blocks',
      trace: [],
      used: new Set<string>(),
      ladders: new Set<string>(),
    },
    general = r.get('session.warmup.general'),
    dynamic = r.get('session.warmup.dynamic'),
    resistance = hasResistanceWarmupContext(template, r),
    range = general.seconds_by_duration[String(durationTier(p.sessionMinutes, p, r))],
    generalRange = Array.isArray(range) ? range : [range, range];
  const usable = (e: Exercise) =>
      e.modality === 'cardio' &&
      e.use.includes('warmup') &&
      !general.exclude_flags.some((flag: string) => e.flags.includes(flag)) &&
      e.difficulty <= r.get('select.difficulty.window').warmup_cooldown_max &&
      hardEligible(e, ctx),
    existing = template.items.findIndex(item => {
      const e = r.byExercise.get(item.exerciseId);
      return item.prescription?.block === 'warmup' && !!e && usable(e);
    });
  const canGeneral =
    existing >= 0 ||
    !resistance ||
    p.sessionMinutes >= general.include_when.session_minutes_min ||
    actualWarmupSeconds(template, p, r) < minimum.warmupSeconds;
  if (canGeneral) {
    const e =
      existing >= 0
        ? r.byExercise.get(template.items[existing].exerciseId)
        : r.data.exercises
            .filter(
              e =>
                usable(e) &&
                !template.items.some(
                  item =>
                    item.exerciseId === e.id ||
                    (e.ladder.id && r.byExercise.get(item.exerciseId)?.ladder.id === e.ladder.id),
                ),
            )
            .sort(
              (a, b) =>
                Number(a.use.includes('cooldown')) - Number(b.use.includes('cooldown')) ||
                a.difficulty - b.difficulty ||
                a.id.localeCompare(b.id, 'en'),
            )[0];
    if (e) {
      const old = existing >= 0 ? template.items[existing] : undefined,
        side = e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1,
        other = actualWarmupSeconds(template, p, r) - (old ? old.sets * setSeconds(old, e, r) : 0),
        overhead = r.get('duration.set.overhead').overhead_s_per_set,
        needed = Math.max(1, Math.ceil((minimum.warmupSeconds - other - overhead) / side)),
        seconds = resistance ? Math.max(generalRange[0], Math.min(generalRange[1], needed)) : needed,
        item = prescribe(e, p, r, s, 'warmup', 1);
      item.target = {
        metricType: e.metricType === 'duration_distance' ? 'duration_distance' : 'duration',
        durationSeconds: seconds,
      };
      item.prescription!.targetRpe = general.intensity_rpe.map((value: number) => Math.min(value, s.maxRpe)) as [
        number,
        number,
      ];
      if (existing >= 0) template.items[existing] = item;
      else template.items.unshift(item);
    }
  }
  const movements = template.items.filter(
      item =>
        item.prescription?.block === 'warmup' &&
        r.byExercise.get(item.exerciseId)?.mobility_type === 'dynamic' &&
        'durationSeconds' in item.target,
    ),
    work = () =>
      movements.reduce((sum, item) => {
        const e = r.byExercise.get(item.exerciseId)!,
          side = item.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
        return sum + ('durationSeconds' in item.target ? item.sets * item.target.durationSeconds * side : 0);
      }, 0);
  if (movements.length >= dynamic.exercises[0] && movements.length <= dynamic.exercises[1])
    for (const item of movements) {
      if (actualWarmupSeconds(template, p, r) >= minimum.warmupSeconds || work() >= dynamic.seconds[1]) break;
      if (!('durationSeconds' in item.target)) continue;
      const e = r.byExercise.get(item.exerciseId)!,
        factor =
          item.sets *
          (item.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1),
        increase = Math.min(
          Math.floor((dynamic.seconds[1] - work()) / factor),
          Math.ceil((minimum.warmupSeconds - actualWarmupSeconds(template, p, r)) / factor),
        );
      item.target.durationSeconds += Math.max(0, increase);
    }
  // Source defaults cannot block the applicable safety minimum; add only its remaining real deficit.
  const deficit = minimum.warmupSeconds - actualWarmupSeconds(template, p, r);
  if (deficit > 0) {
    const item = template.items.find(item => {
        const e = r.byExercise.get(item.exerciseId);
        return item.prescription?.block === 'warmup' && !!e && usable(e);
      }),
      e = item && r.byExercise.get(item.exerciseId);
    if (item && e && 'durationSeconds' in item.target) {
      const factor =
        item.sets *
        (item.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1);
      item.target.durationSeconds += Math.ceil(deficit / factor);
    }
  }
}
