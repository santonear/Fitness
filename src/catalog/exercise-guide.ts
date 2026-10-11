import type { Locale } from '../domain/models';
import { EXERCISE_IDS } from './exercise-ids';
import { exercises } from './exercises';
import { DomainError } from '../domain/errors';
import { catalogMetadata, exerciseBodyPart } from './registry';
import { exerciseVisual } from './exercise-visual';
import guides from './generated/guides-zh.json';
import details from './generated/details.json';
export type ExercisePlace = 'home' | 'gym' | 'outdoor';
export type ExerciseGoal = 'muscle' | 'fat_loss' | 'fitness' | 'mobility' | 'rehab';
export interface ExerciseSearchFilters { place?: ExercisePlace; places?: ExercisePlace[]; equipment?: string[]; bodyParts?: string[]; goal?: ExerciseGoal; goals?: ExerciseGoal[]; cautionAreas?: string[] }
export interface ExerciseGuide { name: string; keyPoints: string[]; steps: string[]; mistakes: string[]; cautions: string[]; media?: {src:string;alt:string;attribution:string} }
export interface ExerciseTags { equipment:string[]; bodyParts:string[]; places:ExercisePlace[]; goals:ExerciseGoal[]; cautionAreas:string[] }
const guideMap:Record<string,{keyPoints:string[];steps:string[];mistakes:string[];cautions:string[]}> = guides;
const detailMap = new Map(details.entries.map(e=>[e.id,e]));
const portable = new Set(['none','dumbbell','kettlebell','resistance-band','loop-band','jump-rope','ab-wheel','stability-ball','flat-bench']);
// A conservative low-intensity list, not a clinical prescription.
const lowIntensity = new Set(['walking','wall-push-ups','bird-dog','dead-bug','glute-bridge','bodyweight-calf-raise','side-lying-hip-abduction','clamshells','cat-cow','chin-tuck-hold']);
function exercise(id:string) {const e=exercises.find(e=>e.id===id);if(!e)throw new DomainError('INVALID','Unknown exercise ID');return e;}
export function getExerciseGuide(id:string,locale:Locale):ExerciseGuide {
 const e=exercise(id),meta=catalogMetadata.get(id),slug=meta?.slug??(id===EXERCISE_IDS.gobletSquat?'goblet-squat':id===EXERCISE_IDS.bodyweightSquat?'bodyweight-squat':undefined),detail=detailMap.get(id);
 const guide=id===EXERCISE_IDS.selfResistedRow?{keyPoints:['一手轻握对侧手腕，提供轻微阻力','活动侧肘向后拉，躯干不旋转'],steps:e.steps[locale],mistakes:locale==='zh'?['用手猛拽手腕；转动身体借力。']:['Do not jerk the wrist or twist the torso.'],cautions:e.cautions[locale]}:slug?guideMap[slug]:undefined;
 const visual=exerciseVisual(id);
 const steps=locale==='zh'?(id===EXERCISE_IDS.gobletSquat?e.steps.zh:guide?.steps??e.steps.zh):(detail?.steps??e.steps.en);
 return structuredClone({name:e.name[locale],keyPoints:locale==='zh'?(guide?.keyPoints??steps.slice(0,2)):(detail?.cautions.slice(0,2).length===2?detail.cautions.slice(0,2):steps.slice(0,2)),steps,
 mistakes:locale==='zh'?(guide?.mistakes??['避免借力猛拉或追求无法控制的动作幅度。']):['Avoid jerking or using a range you cannot control.'],
 cautions:locale==='zh'?(guide?.cautions??e.cautions.zh):(detail?.cautions??e.cautions.en),
 ...(visual?{media:{...visual,alt:e.name[locale]}}:{})});
}
export function getExerciseTags(id:string):ExerciseTags {
 const e=exercise(id),meta=catalogMetadata.get(id),slug=meta?.slug??'',body=exerciseBodyPart(id),muscles=meta?.primaryMuscles??[];
 const bodyParts=[body,...(body.includes('arms')?['arms']:[]),...(body.includes('legs')?['legs']:[]),...(muscles.some(m=>m.includes('glute'))?['glutes']:[])].filter(Boolean);
 if(e.category==='cardio'&&!bodyParts.includes('cardio'))bodyParts.push('cardio');
 const equipment:string[]=[e.equipment];if(e.equipment==='loop-band')equipment.push('resistance-band');if(/bench|incline-db|chest-supported|preacher/.test(slug)&&!equipment.includes('flat-bench'))equipment.push('flat-bench');
 const machine=equipment.some(eq=>!portable.has(eq)&&!['barbell','ez-bar','plates','pull-up-bar','dip-station','rings','suspension-trainer'].includes(eq));
 if(machine)equipment.push('gym-machine');
 const places:ExercisePlace[]=['gym'];if(equipment.every(eq=>portable.has(eq)))places.push('home');if(e.equipment==='none'||['pull-up-bar','dip-station','jump-rope'].includes(e.equipment))places.push('outdoor');
 const mobility=/stretch|pose|cat-cow|pedal|leg-swing|chin-tuck/.test(slug);
 const goals:ExerciseGoal[]=['fitness'];if(mobility)goals.push('mobility');else if(e.category==='cardio')goals.push('fat_loss');else goals.push('muscle','fat_loss');if(lowIntensity.has(slug))goals.push('rehab');
 const cautionAreas:string[]=[];
 // Movement/contact cues only: never infer a joint warning from the primary muscle.
 const movement=slug||(id===EXERCISE_IDS.bodyweightSquat?'bodyweight-squat':id===EXERCISE_IDS.gobletSquat?'goblet-squat':id===EXERCISE_IDS.selfResistedRow?'self-resisted-row':'');
 if(/squat|lunge|jump|burpee|step-ups|leg-press|leg-extension|nordic|sissy/.test(movement))cautionAreas.push('knees');
 if(/deadlift|good-morning|bent-over|barbell-row|t-bar-row|back-extension|sit-up|crunch|russian-twist/.test(movement))cautionAreas.push('back');
 if(/press|push-up|pull-up|chin-up|pulldown|row|fly|lateral-raise|front-raise|pull-apart|dips|overhead/.test(movement))cautionAreas.push('shoulders');
 if(/curl|tricep|triceps|pull-up|chin-up|dips/.test(movement))cautionAreas.push('elbows');
 if(/deadlift|barbell|dumbbell|kettlebell|(^|-)db-|curl|row|pull-up|chin-up|pulldown|pull-apart|press|dips/.test(movement))cautionAreas.push('wrists');
 const forearmSupport=['plank','side-plank','side-plank-leg-lift','side-plank-leg-lift-hold'];
 const palmSupport=['high-plank','bear-plank-hold','bird-dog','bird-dog-hold','bear-crawl','mountain-climbers','plank-knee-tuck','cat-cow','self-resisted-row'];
 if(forearmSupport.includes(movement))cautionAreas.push('shoulders','elbows');
 if(palmSupport.includes(movement)||/push-up/.test(movement))cautionAreas.push('shoulders','wrists');
 return {equipment,bodyParts,places,goals,cautionAreas:[...new Set(cautionAreas)]};
}
export function exerciseCautionAreas(id:string):string[]{return getExerciseTags(id).cautionAreas;}

