/** Shared elapsed-time validation for saved facts and finish previews. */
export function workoutSeconds(startedAt:string,endedAt?:string):number {
 const seconds=endedAt?(Date.parse(endedAt)-Date.parse(startedAt))/1000:NaN;
 return Number.isFinite(seconds)&&seconds>=0&&seconds<=43200?seconds:0;
}
export const trainingMinutes=(seconds:number)=>Math.round(seconds/60);
