import {knownExerciseIds} from '../catalog/registry';
export function legacyExerciseFavorites():{id:string}[]{
 try{const value:unknown=JSON.parse(localStorage.getItem('fitness-exercise-favorites-v1')??'[]');
 return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&knownExerciseIds.has(id)))].map(id=>({id})):[];
 }catch{return []}
}
