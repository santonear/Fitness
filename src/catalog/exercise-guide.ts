import type { Locale } from '../domain/models';
import { getExercise } from './catalog-service';
export type ExercisePlace = 'home' | 'gym' | 'outdoor';
export type ExerciseGoal = 'muscle' | 'fat_loss' | 'fitness' | 'mobility' | 'rehab';
export interface ExerciseSearchFilters { place?: ExercisePlace; places?: ExercisePlace[]; equipment?: string[]; bodyParts?: string[]; goal?: ExerciseGoal; goals?: ExerciseGoal[]; cautionAreas?: string[] }
export interface ExerciseGuide { name: string; keyPoints: string[]; steps: string[]; mistakes: string[]; cautions: string[]; media?: {src:string;alt:string;attribution:string} }
export interface ExerciseTags { equipment:string[]; bodyParts:string[]; places:ExercisePlace[]; goals:ExerciseGoal[]; cautionAreas:string[] }
export function getExerciseGuide(id:string,locale:Locale):ExerciseGuide { const e=getExercise(id);return {name:e.name[locale],keyPoints:e.steps[locale].slice(0,2),steps:e.steps[locale],mistakes:[],cautions:e.cautions[locale]}; }
export function getExerciseTags(id:string):ExerciseTags { const e=getExercise(id);return {equipment:[e.equipment],bodyParts:[],places:['gym'],goals:['fitness'],cautionAreas:[]}; }
