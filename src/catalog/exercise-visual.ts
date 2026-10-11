import { EXERCISE_IDS } from './exercise-ids';
import { catalogMetadata } from './registry';

// Media aliases never change the exercise identity stored in plans or history.
export function exerciseVisualMetadata(id: string) {
 return catalogMetadata.get(id === EXERCISE_IDS.bodyweightSquat ? 'fe06a323-6426-5771-893c-b99a2ca1978d' : id);
}
export function exerciseVisual(id: string) {
 const metadata = exerciseVisualMetadata(id);
 const providerSrc = metadata?.media.start ?? metadata?.media.main ?? metadata?.media.peak;
 if (providerSrc) return { src: providerSrc, attribution: 'Exercise data by RepDB (repdb.co)' };
 const src = id === EXERCISE_IDS.gobletSquat ? '/media/dumbbell-goblet-squat.png'
  : id === EXERCISE_IDS.selfResistedRow ? '/media/self-resisted-row.png' : undefined;
 return src ? { src, attribution: 'Fitness original illustration' } : undefined;
}
