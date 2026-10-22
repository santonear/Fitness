import {knownExerciseIds} from '../catalog/registry';
import {repository,type Repository} from '../persistence/repository';
function createExerciseFavorites(repo:Repository){return {
 async list(){return (await repo.db.exerciseFavorites.toArray()).map(row=>row.id)},
 async toggle(id:string){if(!knownExerciseIds.has(id))throw Error('UNKNOWN_EXERCISE');return repo.write(async()=>{if(await repo.db.exerciseFavorites.get(id))await repo.db.exerciseFavorites.delete(id);else await repo.db.exerciseFavorites.add({id});return (await repo.db.exerciseFavorites.toArray()).map(row=>row.id)})}
}}
export const exerciseFavorites=createExerciseFavorites(repository);
