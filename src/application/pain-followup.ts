import type {WorkoutRecord} from '../domain/v8/contracts';
import type {Caution,Pattern} from '../engine/contracts';
import {Rules,condition} from '../engine/data';
import {DomainError} from '../domain/errors';
export interface PainFollowupInput {painLastedToNextMorning?:boolean;painOrStiffnessWorseThanLastWeek?:boolean;painFollowup?:{workoutId:string;itemIndex:number;painArea:Caution}}
/** Resolve a reported follow-up to an actual performed movement; never manufacture a pain score. */
export function derivePainFollowup(input:PainFollowupInput,history:readonly WorkoutRecord[],rules=new Rules()):{pattern:Pattern;sourceWorkoutId:string;cautionLevelDelta:number}|undefined {
 const source=rules.get('pain.rule').bands.find((band:{action:string})=>band.action==='drop_pattern');
 if(!condition(source.when,{} as never,{pain:{lasted_to_next_morning:input.painLastedToNextMorning,worse_week_on_week:input.painOrStiffnessWorseThanLastWeek}}))return undefined;
 const link=input.painFollowup,record=history.find(record=>record.id===link?.workoutId);
 if(!link||!record||!['complete','partial'].includes(record.status)||!record.endedAt)throw new DomainError('INVALID','PAIN_REVIEW_REQUIRED');
 const facts=record.sets.filter(fact=>fact.itemIndex===link.itemIndex),ids=[...new Set(facts.map(fact=>fact.exerciseId))];
 if(ids.length!==1)throw new DomainError('INVALID','PAIN_REVIEW_REQUIRED');
 const e=rules.byExercise.get(ids[0]),threshold=rules.get('pain.prompt').ask_after_each_set_if.gte;
 if(!e||!(link.painArea==='other'?Object.values(e.joint_load).some(load=>load>=threshold):(e.joint_load[link.painArea]??0)>=threshold))throw new DomainError('INVALID','PAIN_REVIEW_REQUIRED');
 return {pattern:e.primary_pattern,sourceWorkoutId:record.id,cautionLevelDelta:source.caution_level_delta};
}

export function painPromptAreas(exerciseId:string,cautions:readonly Caution[],rules=new Rules()):Caution[]{const exercise=rules.byExercise.get(exerciseId),threshold=rules.get('pain.prompt').ask_after_each_set_if.gte;return cautions.filter(joint=>joint!=='other'&&(exercise?.joint_load[joint]??0)>=threshold);}
