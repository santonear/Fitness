import type { CoachProfile, PlannedItem } from '../../domain/v8/contracts';
import { exercises } from '../../catalog/exercises';
import { estimatePlannedMinutes } from './duration-estimate';

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
  if (/哑铃|dumbbell/i.test(text) && !/(?:没有|无|没带|不用|不使用)\s*哑铃|(?:no|without|don't have|do not have)\s+(?:any\s+)?dumbbells?/i.test(text)) gear.add('dumbbell');
  if (/弹力带|resistance.band/i.test(text) && !/(?:没有|无|没带|不用|不使用)\s*(?:哑铃[和或、]\s*)?弹力带|(?:no|without|don't have|do not have)\s+(?:any\s+)?(?:dumbbells?\s+or\s+)?resistance.bands?/i.test(text)) gear.add('resistance-band');
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
  if (variant % 2 && selected.length > 1) selected.push(selected.shift()!);
  const items: PlannedItem[] = selected.map(({ exercise }) => ({ exerciseId: exercise.id, equipment: exercise.equipment, sets: 2,
    target: exercise.metricType === 'duration' ? { metricType: 'duration', durationSeconds: 20 } : exercise.metricType === 'reps_load' ? { metricType: 'reps_load', reps: 8, loadGrams: 0 } : { metricType: 'reps', reps: 8 } }));
  if (/瘦|减脂|体脂|fat_loss|减重|lose weight|fat loss|weight loss/i.test(profile.goalText) && !profile.cautions.includes('other')) {
    const walking = exercises.find(exercise => exercise.name.en === 'Walking')!;
    items.push({ exerciseId: walking.id, equipment: walking.equipment, sets: 1, target: { metricType: 'duration_distance', durationSeconds: 300 } });
  }
  const range = profile.scheduleOriginalText.match(/(\d{2,3})\s*[–—~～至到-]\s*(\d{2,3})\s*(?:分钟|分鐘|minutes?|mins?)/i);
  const ceiling = range ? Math.min(120, Number(range[2])) : profile.sessionMinutes;
  const target = range ? Math.max(Number(range[1]), Math.min(ceiling, profile.sessionMinutes)) : profile.sessionMinutes;
  if (items.length) {
    for (const item of items) item.sets = 1;
    // Bound volume rather than manufacture extra sets to fill a long slot.
    while (estimatePlannedMinutes(items) < target) {
      const minimum = Math.min(...items.filter(item => !('durationSeconds' in item.target && item.target.durationSeconds === 300)).map(item => item.sets));
      const next = items.find(item => item.sets === minimum && item.sets < 4 && !('durationSeconds' in item.target && item.target.durationSeconds === 300));
      if (!next) {
        const extra=pool.find(choice=>!items.some(item=>item.exerciseId===choice.exercise.id));
        if(!extra)break;
        const exercise=extra.exercise;
        items.push({exerciseId:exercise.id,equipment:exercise.equipment,sets:1,target:exercise.metricType==='duration'?{metricType:'duration',durationSeconds:20}:exercise.metricType==='reps_load'?{metricType:'reps_load',reps:8,loadGrams:0}:{metricType:'reps',reps:8}});
        continue;
      }
      next.sets++;
      if (estimatePlannedMinutes(items) > ceiling) { next.sets--; break; }
    }
  }
  return { items, missing };
}

/** Explicit conservative subset; unknown movements or unspecified cautions have no inferred replacement. */
export function discomfortReplacement(exerciseId: string, profile: CoachProfile): PlannedItem | undefined {
  const source=exercises.find(e=>e.id===exerciseId);
  const family=choices.find(c=>c.name.toLowerCase()===source?.name.en.toLowerCase())?.family;
  if(!family||profile.cautions.includes('other'))return undefined;
  const lowerImpact=['Clamshells','Wall Push Ups','Band Pull Apart','Dead Bug'];
  return choices.flatMap((_,v)=>basicItems(profile,v).items).find(item=>{
    const name=exercises.find(e=>e.id===item.exerciseId)?.name.en;
    return item.exerciseId!==exerciseId&&!!name&&lowerImpact.includes(name)&&choices.find(c=>c.name===name)?.family===family;
  });
}

/** Text-only example from the existing conservative subset; no equipment is assumed. */
export function discomfortExample(cautions: CoachProfile['cautions']) {
  if (!cautions.length || cautions.includes('other')) return undefined;
  return choices.filter(choice => ['Clamshells', 'Wall Push Ups', 'Dead Bug'].includes(choice.name))
    .filter(choice => !choice.avoid.some(area => cautions.includes(area as Area)))
    .map(choice => exercises.find(exercise => exercise.name.en.toLowerCase() === choice.name.toLowerCase()))
    .find(exercise => exercise?.equipment === 'none');
}
