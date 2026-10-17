import { EXERCISE_IDS } from './exercise-ids';
import { catalogMetadata } from './registry';
import {customCatalog,customExerciseIds} from './custom-exercises';

// Media aliases never change the exercise identity stored in plans or history.
export function exerciseVisualMetadata(id: string) {
 if(customExerciseIds.has(id))return undefined;
 return catalogMetadata.get(id === EXERCISE_IDS.bodyweightSquat ? 'fe06a323-6426-5771-893c-b99a2ca1978d' : id);
}
export function exerciseVisual(id: string) {
 // A non-figurative pattern icon; never a stick figure or invented technique image.
 const custom=customCatalog.find(row=>row.id===id);
 if(custom){
  const symbol=custom.pattern.startsWith('pull')?'←':custom.pattern.startsWith('push')?'→':custom.pattern==='balance'?'↔':custom.pattern==='carry'?'⇥':'◇';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200"><rect width="280" height="200" rx="24" fill="#f2f5f0"/><text x="140" y="115" text-anchor="middle" font-size="80" fill="#48634c">${symbol}</text></svg>`;
  return{src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),attribution:'Fitness original movement-pattern symbol'};
 }
 const metadata = exerciseVisualMetadata(id);
 const providerSrc = metadata?.media.start ?? metadata?.media.main ?? metadata?.media.peak;
 if (providerSrc) return { src: providerSrc, attribution: 'Exercise data by RepDB (repdb.co)' };
 const src = id === EXERCISE_IDS.gobletSquat ? '/media/dumbbell-goblet-squat.png'
  : id === EXERCISE_IDS.selfResistedRow ? '/media/self-resisted-row.png' : undefined;
 return src ? { src, attribution: 'Fitness original illustration' } : undefined;
}
