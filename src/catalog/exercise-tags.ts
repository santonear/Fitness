import { EXERCISE_IDS } from './exercise-ids';
import { exercises } from './exercises';
import { DomainError } from '../domain/errors';
import { catalogMetadata, exerciseBodyPart } from './registry';
// Tags and caution areas stay apart from the guide text so search and filters do not download the guides.
export type ExercisePlace = 'home' | 'gym' | 'outdoor';
export type ExerciseGoal = 'muscle' | 'fat_loss' | 'fitness' | 'mobility' | 'rehab';
export interface ExerciseSearchFilters {
  place?: ExercisePlace;
  places?: ExercisePlace[];
  equipment?: string[];
  bodyParts?: string[];
  goal?: ExerciseGoal;
  goals?: ExerciseGoal[];
  cautionAreas?: string[];
}
export interface ExerciseTags {
  equipment: string[];
  bodyParts: string[];
  places: ExercisePlace[];
  goals: ExerciseGoal[];
  cautionAreas: string[];
}
const portable = new Set([
  'none',
  'dumbbell',
  'kettlebell',
  'resistance-band',
  'loop-band',
  'jump-rope',
  'ab-wheel',
  'stability-ball',
  'flat-bench',
]);
// A conservative low-intensity list, not a clinical prescription.
const lowIntensity = new Set([
  'walking',
  'wall-push-ups',
  'bird-dog',
  'dead-bug',
  'glute-bridge',
  'bodyweight-calf-raise',
  'side-lying-hip-abduction',
  'clamshells',
  'cat-cow',
  'chin-tuck-hold',
]);
export function exercise(id: string) {
  const e = exercises.find(e => e.id === id);
  if (!e) throw new DomainError('INVALID', 'Unknown exercise ID');
  return e;
}
export function getExerciseTags(id: string): ExerciseTags {
  const e = exercise(id),
    meta = catalogMetadata.get(id),
    slug = meta?.slug ?? '',
    body = exerciseBodyPart(id),
    muscles = meta?.primaryMuscles ?? [];
  const bodyParts = [
    body,
    ...(body.includes('arms') ? ['arms'] : []),
    ...(body.includes('legs') ? ['legs'] : []),
    ...(muscles.some(m => m.includes('glute')) ? ['glutes'] : []),
  ].filter(Boolean);
  if (e.category === 'cardio' && !bodyParts.includes('cardio')) bodyParts.push('cardio');
  const equipment: string[] = [e.equipment];
  if (e.equipment === 'loop-band') equipment.push('resistance-band');
  if (/bench|incline-db|chest-supported|preacher/.test(slug) && !equipment.includes('flat-bench'))
    equipment.push('flat-bench');
  const machine = equipment.some(
    eq =>
      !portable.has(eq) &&
      !['barbell', 'ez-bar', 'plates', 'pull-up-bar', 'dip-station', 'rings', 'suspension-trainer'].includes(eq),
  );
  if (machine) equipment.push('gym-machine');
  const places: ExercisePlace[] = ['gym'];
  if (equipment.every(eq => portable.has(eq))) places.push('home');
  if (e.equipment === 'none' || ['pull-up-bar', 'dip-station', 'jump-rope'].includes(e.equipment))
    places.push('outdoor');
  const mobility = /stretch|pose|cat-cow|pedal|leg-swing|chin-tuck/.test(slug);
  const goals: ExerciseGoal[] = ['fitness'];
  if (mobility) goals.push('mobility');
  else if (e.category === 'cardio') goals.push('fat_loss');
  else goals.push('muscle', 'fat_loss');
  if (lowIntensity.has(slug)) goals.push('rehab');
  const cautionAreas: string[] = [];
  // Movement/contact cues only: never infer a joint warning from the primary muscle.
  const movement =
    slug ||
    (id === EXERCISE_IDS.bodyweightSquat
      ? 'bodyweight-squat'
      : id === EXERCISE_IDS.gobletSquat
        ? 'goblet-squat'
        : id === EXERCISE_IDS.selfResistedRow
          ? 'self-resisted-row'
          : '');
  if (/squat|lunge|jump|burpee|step-ups|leg-press|leg-extension|nordic|sissy/.test(movement))
    cautionAreas.push('knees');
  if (/deadlift|good-morning|bent-over|barbell-row|t-bar-row|back-extension|sit-up|crunch|russian-twist/.test(movement))
    cautionAreas.push('back');
  const upperPress = /press|ohp/.test(movement) && !/leg-press|calf|hip|glute/.test(movement);
  const armCurl = /curl/.test(movement) && !/leg-curl|hamstring|nordic|jefferson|banded-standing-curl/.test(movement);
  const upperPull = /row|pull-up|chin-up|pulldown|pull-apart/.test(movement);
  if (
    upperPress ||
    upperPull ||
    /push-up|fly|lateral-raise|front-raise|dips|overhead|arnold|pec-deck|ab-wheel/.test(movement)
  )
    cautionAreas.push('shoulders');
  if (armCurl || /tricep|triceps|pull-up|chin-up|dips/.test(movement)) cautionAreas.push('elbows');
  // External load alone does not imply wrist loading: a bar resting on the hips is not a hand-supported lift.
  if (upperPress || armCurl || upperPull || /deadlift|dips|ab-wheel/.test(movement)) cautionAreas.push('wrists');
  const forearmSupport = ['plank', 'side-plank', 'side-plank-leg-lift', 'side-plank-leg-lift-hold'];
  const palmSupport = [
    'high-plank',
    'bear-plank-hold',
    'bird-dog',
    'bird-dog-hold',
    'bear-crawl',
    'mountain-climbers',
    'plank-knee-tuck',
    'cat-cow',
    'self-resisted-row',
  ];
  if (forearmSupport.includes(movement)) cautionAreas.push('shoulders', 'elbows');
  if (palmSupport.includes(movement) || /push-up/.test(movement)) cautionAreas.push('shoulders', 'wrists');
  return { equipment, bodyParts, places, goals, cautionAreas: [...new Set(cautionAreas)] };
}
export function exerciseCautionAreas(id: string): string[] {
  return getExerciseTags(id).cautionAreas;
}
