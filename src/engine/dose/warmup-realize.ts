import { type Template } from '../dose';
import { type EngineProfile } from '../contracts';
import { type Rules } from '../data';
import { durationTier, sourcePosition } from './warmup-identity';
import { sourceWarmupRamps } from './warmup-source';
import { isHardEligible } from '../candidates';
import { runGates } from '../gates';

/** Realize only a source-authored bodyweight ramp slot; loaded protocols stay untouched. */
export function realizeBodyweightWarmup<T extends Template>(template: T, p: EngineProfile, r: Rules): T {
  const copy = structuredClone(template),
    found = mainRampSlot(template, p, r);
  if (!found) return copy;
  const { ramp, slot } = found;
  const index = copy.items.findIndex(
    item =>
      item.prescription?.block === 'warmup' &&
      (item.prescription.sourcePosition === template.id + '-' + slot.slot ||
        item.prescription.sourcePosition === slot.slot),
  );
  if (index < 0) return copy;
  const main = copy.items[ramp.itemIndex],
    e = r.byExercise.get(main.exerciseId),
    placeholder = copy.items[index];
  if (!e?.use.includes('warmup') || !main.prescription || !placeholder.prescription || ramp.scheme.length !== 1)
    return copy;
  const prescription = {
    ...placeholder.prescription,
    pattern: e.primary_pattern,
    block: 'warmup' as const,
    perSide: main.prescription.perSide,
    secondsPerRep: main.prescription.secondsPerRep,
  };
  for (const key of ['groupId', 'roundRestSeconds', 'warmupSeconds', 'targetRpe', 'goalRole'] as const)
    delete prescription[key];
  prescription.structure = 'straight';
  if (main.prescription.tempo) prescription.tempo = structuredClone(main.prescription.tempo);
  else delete prescription.tempo;
  copy.items[index] = {
    ...structuredClone(main),
    sets: ramp.scheme.length,
    target: { metricType: 'reps', reps: ramp.scheme[0].reps },
    prescription,
  };
  if (!isRealizedBodyweightWarmup(copy, index, p, r)) return structuredClone(template);
  if (main.prescription.warmupSeconds === ramp.seconds) delete main.prescription.warmupSeconds;
  return copy;
}

/** Reprove the narrow source exception from actual identities, positions and execution. */
export function isRealizedBodyweightWarmup(template: Template, index: number, p: EngineProfile, r: Rules): boolean {
  const warm = template.items[index],
    rx = warm?.prescription;
  if (
    !rx ||
    rx.block !== 'warmup' ||
    rx.structure !== 'straight' ||
    rx.groupId !== undefined ||
    rx.roundRestSeconds !== undefined ||
    rx.warmupSeconds !== undefined ||
    warm.target.metricType !== 'reps'
  )
    return false;
  const slot = rampRecipe(template, p, r).slots.find(
    (slot: RampSlot) =>
      isRampWarmupSlot(slot) &&
      (rx.sourcePosition === slot.slot || rx.sourcePosition === template.id + '-' + slot.slot),
  );
  if (!slot) return false;
  if (
    template.items.filter(
      item =>
        item.prescription?.block === 'warmup' &&
        (item.prescription.sourcePosition === slot.slot ||
          item.prescription.sourcePosition === template.id + '-' + slot.slot),
    ).length !== 1
  )
    return false;
  const ramp = mainBodyweightRamp(template, p, r);
  if (!ramp || ramp.itemIndex <= index || ramp.scheme.length !== 1) return false;
  const main = template.items[ramp.itemIndex],
    mr = main.prescription!,
    e = r.byExercise.get(main.exerciseId),
    w = r.byExercise.get(warm.exerciseId);
  if (
    main.target.metricType !== 'reps' ||
    !e ||
    !w ||
    w.modality !== 'strength' ||
    w.metricType !== 'reps' ||
    warm.equipment !== 'none' ||
    !e.equipment_required.every(k => k === 'none') ||
    !w.equipment_required.every(k => k === 'none') ||
    !w.use.includes('warmup')
  )
    return false;
  if (
    warm.exerciseId !== main.exerciseId &&
    !(
      w.ladder.id !== null &&
      w.ladder.id === e.ladder.id &&
      w.ladder.step === e.ladder.step - 1 &&
      w.primary_pattern === e.primary_pattern
    )
  )
    return false;
  if (
    warm.sets !== r.get('session.warmup.ramp_sets').bodyweight_main.sets ||
    !Number.isInteger(warm.target.reps) ||
    warm.target.reps !== ramp.scheme[0].reps
  )
    return false;
  const cadence = mr.secondsPerRep ?? e.time.s_per_rep ?? r.get('duration.rep.seconds').default_if_unknown;
  if (
    (rx.secondsPerRep ?? w.time.s_per_rep ?? r.get('duration.rep.seconds').default_if_unknown) !== cadence ||
    !!(rx.perSide || w.time.per_side) !== !!(mr.perSide || e.time.per_side) ||
    rx.pattern !== w.primary_pattern ||
    JSON.stringify(rx.tempo) !== JSON.stringify(mr.tempo)
  )
    return false;
  return isHardEligible(w, p, runGates(p, r), { rules: r });
}

interface RampSlot {
  slot: string;
  block: string;
  ramp?: string;
  pattern?: unknown;
}

/** The first main slot's bodyweight ramp and the recipe warmup slot that may carry it. */
export function mainRampSlot(template: Template, p: EngineProfile, r: Rules) {
  const recipe = rampRecipe(template, p, r),
    ramp = mainBodyweightRamp(template, p, r);
  if (!ramp) return undefined;
  const slot = recipe.slots.find(isRampWarmupSlot);
  return slot ? { ramp, slot } : undefined;
}

/** The session recipe whose warmup slot may carry the bodyweight ramp. */
function rampRecipe(template: Template, p: EngineProfile, r: Rules) {
  const minutes = Math.min(p.sessionMinutes, template.targetMinutes ?? p.sessionMinutes);
  return r.get(`session.template.min${durationTier(minutes, p, r)}`);
}

function isRampWarmupSlot(slot: RampSlot): boolean {
  return (
    slot.block === 'warmup' &&
    !!slot.ramp &&
    ['from_slot_M1', 'from_slot_SS1_first', 'from_next_slot'].includes(String(slot.pattern))
  );
}

/** The source bodyweight ramp of the template's first main slot, if any. */
function mainBodyweightRamp(template: Template, p: EngineProfile, r: Rules) {
  return sourceWarmupRamps(template, p, r).find(
    row => row.kind === 'bodyweight_main' && sourcePosition(template.items[row.itemIndex], template) === 'main_1',
  );
}
