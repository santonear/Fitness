import type { Locale } from '../domain/models';
import { EXERCISE_IDS } from './exercise-ids';
import { exercises } from './exercises';
import { DomainError } from '../domain/errors';
import { catalogMetadata, exerciseBodyPart } from './registry';
import { getExerciseMedia } from './media';
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
 const guide=slug?guideMap[slug]:undefined;
 const local=getExerciseMedia(id);const src=meta?.media.start??meta?.media.main??meta?.media.peak??local?.illustration;
 const steps=locale==='zh'?(id===EXERCISE_IDS.gobletSquat?e.steps.zh:guide?.steps??e.steps.zh):(detail?.steps??e.steps.en);
 return structuredClone({name:e.name[locale],keyPoints:locale==='zh'?(guide?.keyPoints??steps.slice(0,2)):(detail?.cautions.slice(0,2).length===2?detail.cautions.slice(0,2):steps.slice(0,2)),steps,
 mistakes:locale==='zh'?(guide?.mistakes??['避免借力猛拉或追求无法控制的动作幅度。']):['Avoid jerking or using a range you cannot control.'],
 cautions:locale==='zh'?(guide?.cautions??e.cautions.zh):(detail?.cautions??e.cautions.en),
 ...(src?{media:{src,alt:e.name[locale],attribution:meta?'Exercise data by RepDB (repdb.co)':'Fitness original illustration'}}:{})});
}
export function getExerciseTags(id:string):ExerciseTags {
 const e=exercise(id),meta=catalogMetadata.get(id),slug=meta?.slug??'',body=exerciseBodyPart(id),muscles=meta?.primaryMuscles??[];
 const bodyParts=[body,...(body.includes('arms')?['arms']:[]),...(body.includes('legs')?['legs']:[]),...(muscles.some(m=>m.includes('glute'))?['glutes']:[])].filter(Boolean);
 const equipment:string[]=[e.equipment];if(/bench|incline-db|chest-supported|preacher/.test(slug)&&!equipment.includes('flat-bench'))equipment.push('flat-bench');
 const machine=equipment.some(eq=>!portable.has(eq)&&!['barbell','ez-bar','plates','pull-up-bar','dip-station','rings','suspension-trainer'].includes(eq));
 if(machine)equipment.push('gym-machine');
 const places:ExercisePlace[]=['gym'];if(equipment.every(eq=>portable.has(eq)))places.push('home');if(e.equipment==='none'||['pull-up-bar','dip-station','jump-rope'].includes(e.equipment))places.push('outdoor');
 const mobility=/stretch|pose|cat-cow|pedal|leg-swing|chin-tuck/.test(slug);
 const goals:ExerciseGoal[]=['fitness'];if(mobility)goals.push('mobility');else if(e.category==='cardio')goals.push('fat_loss');else goals.push('muscle','fat_loss');if(lowIntensity.has(slug))goals.push('rehab');
 const cautionAreas:string[]=[];
 if(bodyParts.some(x=>['chest','shoulders','back','arms'].includes(x)))cautionAreas.push('shoulders','elbows','wrists');
 if(bodyParts.some(x=>['legs','glutes','cardio'].includes(x)))cautionAreas.push('knees','hips','ankles');
 if(['core','back','legs','full-body'].includes(body)||/deadlift|row|squat|press/.test(slug))cautionAreas.push('back');
 return {equipment,bodyParts,places,goals,cautionAreas:[...new Set(cautionAreas)]};
}
export function exerciseCautionAreas(id:string):string[]{return getExerciseTags(id).cautionAreas;}

