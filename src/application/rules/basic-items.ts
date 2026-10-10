import type { CoachProfile, PlannedItem } from '../../domain/v8/contracts';
import { exercises } from '../../catalog/exercises';
import { estimateTrainingMinutes } from './duration-estimate';

type Area = CoachProfile['cautions'][number];
// Conservative exclusions, not a medical suitability assessment.
const choices = [
  { name: 'Bodyweight squat', family: 'lower', avoid: ['knee', 'back'] },
  { name: 'Glute Bridge', family: 'lower', avoid: ['knee', 'back'] },
  { name: 'Clamshells', family: 'lower', avoid: ['back'] },
  { name: 'Wall Push Ups', family: 'push', avoid: ['shoulder', 'wrist', 'back'] },
  { name: 'Dumbbell Floor Press', family: 'push', avoid: ['shoulder', 'wrist'] },
  { name: 'Band Pull Apart', family: 'pull', avoid: ['shoulder', 'wrist'] },
  { name: 'Bent-Over Dumbbell Row', family: 'pull', avoid: ['back', 'shoulder', 'wrist'] },
  { name: 'Self-resisted Row', family: 'pull', avoid: ['back', 'shoulder', 'wrist'] },
  { name: 'Dead Bug', family: 'core', avoid: ['back', 'shoulder'] },
  { name: 'Plank', family: 'core', avoid: ['back', 'shoulder', 'wrist'] },
  { name: 'Bodyweight Calf Raise', family: 'lower', avoid: ['knee', 'back'] },
] as const;
export function basicItems(profile: CoachProfile, variant: number): { items: PlannedItem[]; missing: string[] } {
  const text = profile.equipment.join(' ');
  const gear = new Set(['none']);
  if (/哑铃|dumbbell/i.test(text)) gear.add('dumbbell');
  if (/弹力带|resistance.band/i.test(text)) gear.add('resistance-band');
  const pool = choices.flatMap(choice => {
    const exercise = exercises.find(e => e.name.en.toLowerCase() === choice.name.toLowerCase());
    return exercise && gear.has(exercise.equipment) && !profile.cautions.includes('other') && !choice.avoid.some(area => profile.cautions.includes(area as Area)) ? [{ ...choice, exercise }] : [];
  });
  const selected: typeof pool = [];
  const missing: string[] = [];
  for (const family of ['lower', 'push', 'pull', 'core']) {
    const options = pool.filter(c => c.family === family);
    if (options.length) selected.push(options[variant % options.length]); else missing.push(family);
  }
  for (const extra of pool) if (selected.length < 4 && !selected.includes(extra)) selected.push(extra);
  const items: PlannedItem[] = selected.map(({ exercise }) => ({ exerciseId: exercise.id, equipment: exercise.equipment, sets: 2,
    target: exercise.metricType === 'duration' ? { metricType: 'duration', durationSeconds: 20 } : exercise.metricType === 'reps_load' ? { metricType: 'reps_load', reps: 8, loadGrams: 0 } : { metricType: 'reps', reps: 8 } }));
  const estimate = () => estimateTrainingMinutes(items.map(item => ({ sets: Array.from({ length: item.sets }, () => 'reps' in item.target ? { reps: item.target.reps } : { durationSeconds: item.target.durationSeconds }) })));
  if (items.length && estimate() > profile.sessionMinutes) for (const item of items) item.sets = 1;
  return { items, missing };
}

/** Explicit conservative subset; unknown movements or unspecified cautions have no inferred replacement. */
export function discomfortReplacement(exerciseId: string, profile: CoachProfile): PlannedItem | undefined {
  const source=exercises.find(e=>e.id===exerciseId);
  const family=choices.find(c=>c.name.toLowerCase()===source?.name.en.toLowerCase())?.family;
  if(!family||profile.cautions.includes('other'))return undefined;
  const lowerImpact=['Clamshells','Wall Push Ups','Band Pull Apart','Dead Bug'];
  return [0,1].flatMap(v=>basicItems(profile,v).items).find(item=>{
    const name=exercises.find(e=>e.id===item.exerciseId)?.name.en;
    return item.exerciseId!==exerciseId&&!!name&&lowerImpact.includes(name)&&choices.find(c=>c.name===name)?.family===family;
  });
}
