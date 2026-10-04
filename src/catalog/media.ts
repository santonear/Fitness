import { EXERCISE_IDS } from './exercise-ids';
export interface ExerciseMediaEntry {
 illustration: string;
 source: { title: string; url: string };
 videoId?: string;
 evidence: 'publisher-linked' | 'title-match-only' | 'no-video';
 checkedOn: '2026-10-05';
}
export const exerciseMedia: Readonly<Record<string, ExerciseMediaEntry>> = Object.freeze({
 [EXERCISE_IDS.gobletSquat]: { illustration: '/media/goblet-squat.svg', source: { title: 'NASM — Goblet Squat', url: 'https://www.nasm.org/resource-center/exercise-library/goblet-squat' }, videoId: 'nfX7IFK9UNI', evidence: 'publisher-linked', checkedOn: '2026-10-05' },
 [EXERCISE_IDS.walking]: { illustration: '/media/walking.svg', source: { title: 'NHS — Walking for health', url: 'https://www.nhs.uk/live-well/exercise/walking-for-health/' }, evidence: 'no-video', checkedOn: '2026-10-05' },
 [EXERCISE_IDS.bodyweightSquat]: { illustration: '/media/bodyweight-squat.svg', source: { title: 'Bupa Health — How to do a bodyweight squat', url: 'https://www.youtube.com/watch?v=m0GcZ24pK6k' }, videoId: 'm0GcZ24pK6k', evidence: 'title-match-only', checkedOn: '2026-10-05' },
 [EXERCISE_IDS.plank]: { illustration: '/media/plank.svg', source: { title: 'Catalyst Athletics — Plank', url: 'https://www.catalystathletics.com/exercise/448/Plank/' }, evidence: 'no-video', checkedOn: '2026-10-05' },
});
const videoIds = new Set(['nfX7IFK9UNI', 'm0GcZ24pK6k']);
export function youtubeEmbedUrl(videoId: string): string | undefined {
 return videoIds.has(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0` : undefined;
}
