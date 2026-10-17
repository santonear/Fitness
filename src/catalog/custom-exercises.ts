import data from './custom-exercises.json';
import type {Exercise} from '../domain/models';
export const customCatalog=data;
export const customExerciseIds=new Set(data.map(row=>row.id));
export const customExercises:Exercise[]=data.map(({slug:_,primaryMuscles:__,secondaryMuscles:___,bodyPart:____,pattern:_____,contentSource:______,...exercise})=>exercise as Exercise);
