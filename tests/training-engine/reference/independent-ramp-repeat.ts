import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { EnginePlan, EngineProfile } from '../../../src/engine/contracts';
import catalog from '../../../src/engine/generated/exercise-index.json';
type Template = EnginePlan['templates'][number];
type RawRule = { id: string; value: Record<string, any> };
/** Authored YAML and raw catalog only: no generator, ramp, gate or eligibility predicates. */
export const rampRepeatSource = Object.fromEntries(
  ['02', '03', '04', '05', '06']
    .flatMap(
      chapter =>
        parse(
          readFileSync(new URL(`../../../data/training-engine/rules/rules-ch${chapter}.yaml`, import.meta.url), 'utf8'),
        ) as RawRule[],
    )
    .map(rule => [rule.id, rule.value]),
);
export function independentlyRepeatedExerciseIds(t: Template, p: EngineProfile, source = rampRepeatSource): string[] {
  const rules = source,
    durations = rules['session.durations.allowed'],
    minutes = Math.min(t.targetMinutes ?? p.sessionMinutes, p.sessionMinutes),
    rawTier = durations.minutes.filter((value: number) => value <= minutes).at(-1),
    tier =
      rawTier === 90 && !durations.min90_requires_level.includes(p.level) ? durations.min90_beginner_fallback : rawTier,
    recipe = rules[`session.template.min${tier}`],
    protocol = rules['session.warmup.ramp_sets'];
  const position = (item: Template['items'][number]) => {
    const value = item.prescription?.sourcePosition;
    if (!value) return;
    return /^(main|acc|core)_\d+$/.test(value)
      ? value
      : value.startsWith(t.id + '-')
        ? value.match(/-((?:main|acc|core)_\d+)$/)?.[1]
        : undefined;
  };
  const work = t.items.filter(item => ['main', 'accessory'].includes(item.prescription?.block ?? '')),
    mains = work.filter(item => /^main_\d+$/.test(position(item) ?? ''));
  const allowed = new Set<string>();
  for (const [id, value] of Object.entries(rules)) {
    const match = /^week\.template\.rt(\d+)$/.exec(id);
    if (!match || Number(match[1]) > Math.min(p.daysPerWeek, rules[`goal.params.${p.goal}`].rt_sessions_week.max))
      continue;
    const rows = [
      value,
      ...(value.variants ?? []).filter(
        (row: Record<string, any>) =>
          !row.when ||
          ((row.when.session_minutes_min === undefined || minutes >= row.when.session_minutes_min) &&
            (row.when.session_minutes_max === undefined || minutes <= row.when.session_minutes_max)),
      ),
    ];
    for (const row of rows)
      for (const day of [row.rotation, row.fallback_if_short_sessions?.rotation].flat(Infinity))
        if (typeof day === 'string') allowed.add(day);
  }
  const coherentDay = Object.entries(rules).some(
    ([id, value]) =>
      id.startsWith('week.day.') &&
      allowed.has(id.slice(9)) &&
      mains.every(item => {
        const e = catalog.exercises.find(e => e.id === item.exerciseId);
        return (
          !!e &&
          value.slots.some(
            (slot: Record<string, any>) => slot.pos === position(item) && slot.pattern.includes(e.primary_pattern),
          )
        );
      }),
  );
  const exempt = (warm: Template['items'][number], index: number) => {
    const rx = warm.prescription;
    if (
      rules['variety.no_repeat'].ramp_sets_exempt !== true ||
      protocol.counted_as_working_set !== false ||
      !coherentDay ||
      new Set(mains.map(position)).size !== mains.length ||
      !rx ||
      rx.block !== 'warmup' ||
      rx.structure !== 'straight' ||
      warm.target.metricType !== 'reps'
    )
      return false;
    if (
      ['groupId', 'roundRestSeconds', 'warmupSeconds', 'goalRole', 'targetRpe', 'loadBand', 'loadDescription'].some(
        key => (rx as Record<string, unknown>)[key] !== undefined,
      )
    )
      return false;
    const rampSlot = recipe?.slots.find(
      (slot: Record<string, any>) =>
        slot.block === 'warmup' &&
        slot.ramp &&
        ['from_slot_M1', 'from_slot_SS1_first', 'from_next_slot'].includes(slot.pattern) &&
        (rx.sourcePosition === slot.slot || rx.sourcePosition === `${t.id}-${slot.slot}`),
    );
    if (!rampSlot || t.items.filter(item => item.prescription?.sourcePosition === rx.sourcePosition).length !== 1)
      return false;
    const main = mains.find(item => position(item) === 'main_1'),
      mr = main?.prescription,
      e = catalog.exercises.find(e => e.id === main?.exerciseId);
    if (
      !main ||
      !mr ||
      !e ||
      t.items.indexOf(main) <= index ||
      main.exerciseId !== warm.exerciseId ||
      main.target.metricType !== 'reps' ||
      e.modality !== 'strength' ||
      e.nsca_class !== 'compound' ||
      e.metricType !== 'reps' ||
      warm.equipment !== 'none' ||
      main.equipment !== 'none' ||
      !e.equipment_required.every(key => key === 'none') ||
      !e.use.includes('warmup') ||
      (p.goal === 'strength' && mr.goalRole === 'accessory')
    )
      return false;
    const mainSlot = recipe.slots.find((slot: Record<string, any>) => slot.from_pos?.includes('main_1'));
    if (
      !mainSlot ||
      mr.block !== mainSlot.block ||
      !['main_1', `${t.id}-${mainSlot.slot}-main_1`].includes(mr.sourcePosition ?? '') ||
      warm.sets !== protocol.bodyweight_main.sets ||
      warm.target.reps !== Math.ceil(main.target.reps * protocol.bodyweight_main.target_rep_fraction)
    )
      return false;
    const cadence = mr.secondsPerRep ?? e.time.s_per_rep ?? rules['duration.rep.seconds'].default_if_unknown,
      tempo = rules['dose.tempo'].rep_duration_s;
    return (
      Number.isInteger(warm.target.reps) &&
      warm.target.reps > 0 &&
      (cadence === e.time.s_per_rep || (cadence >= tempo.min && cadence <= tempo.max)) &&
      (rx.secondsPerRep ?? e.time.s_per_rep ?? rules['duration.rep.seconds'].default_if_unknown) === cadence &&
      !!(rx.perSide || e.time.per_side) === !!(mr.perSide || e.time.per_side) &&
      rx.pattern === e.primary_pattern &&
      JSON.stringify(rx.tempo) === JSON.stringify(mr.tempo)
    );
  };
  const seen = new Set<string>(),
    duplicates: string[] = [];
  for (const [index, item] of t.items.entries()) {
    if (exempt(item, index)) continue;
    if (seen.has(item.exerciseId)) duplicates.push(item.exerciseId);
    seen.add(item.exerciseId);
  }
  return duplicates;
}
