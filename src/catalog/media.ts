import { EXERCISE_IDS } from './exercise-ids';
export interface ExerciseMediaEntry {
 illustration: string;
 source: { title: string; url: string };
 videoId?: string;
 video?: { title: string; publisher: string; scope: 'exercise' | 'gait-and-falls'; sourceUrl: string };
 evidence: 'publisher-linked' | 'publisher-metadata' | 'title-match-only' | 'no-video';
 checkedOn: '2026-10-06';
 illustrationRights: { status: 'project-original'; notice: '/media/NOTICE.md'; professionalReview: 'not-reviewed' };
 videoReview: { content: 'not-reviewed'; playback: 'not-verified' | 'no-video'; reuseLicense: 'not-verified' };
}
const entries = {
 [EXERCISE_IDS.gobletSquat]: { illustration: '/media/goblet-squat.svg', source: { title: 'NASM — Goblet Squat', url: 'https://www.nasm.org/resource-center/exercise-library/goblet-squat' }, videoId: 'nfX7IFK9UNI', video: { title: 'How to do a Goblet Squat | Proper Form & Technique | NASM', publisher: 'National Academy of Sports Medicine (NASM)', scope: 'exercise', sourceUrl: 'https://www.nasm.org/resource-center/exercise-library/goblet-squat' }, evidence: 'publisher-linked', checkedOn: '2026-10-06' },
 [EXERCISE_IDS.walking]: { illustration: '/media/walking.svg', source: { title: 'NHS — Walking for health', url: 'https://www.nhs.uk/live-well/exercise/walking-for-health/' }, videoId: '4PR9GedBrZY', video: { title: 'Preventing falls – exercises to reduce your risk of a fall', publisher: 'Leicestershire County Council', scope: 'gait-and-falls', sourceUrl: 'https://www.leicspart.nhs.uk/wp-content/uploads/2019/02/660-Advice-on-gait-A4-folded-to-A5.pdf' }, evidence: 'publisher-linked', checkedOn: '2026-10-06' },
 [EXERCISE_IDS.bodyweightSquat]: { illustration: '/media/bodyweight-squat.svg', source: { title: 'Bupa Health — How to do a body weight squat', url: 'https://www.youtube.com/watch?v=m0GcZ24pK6k' }, videoId: 'm0GcZ24pK6k', video: { title: 'How to do a body weight squat | Bupa Health', publisher: 'Bupa Health', scope: 'exercise', sourceUrl: 'https://www.youtube.com/watch?v=m0GcZ24pK6k' }, evidence: 'publisher-metadata', checkedOn: '2026-10-06' },
 [EXERCISE_IDS.plank]: { illustration: '/media/plank.svg', source: { title: 'Catalyst Athletics — Plank', url: 'https://www.catalystathletics.com/exercise/448/Plank/' }, videoId: 'P3FR4GUl2QM', video: { title: 'Plank | Olympic Weightlifting Exercise Library', publisher: 'Catalyst Athletics', scope: 'exercise', sourceUrl: 'https://www.catalystathletics.com/exercise/448/Plank/' }, evidence: 'publisher-linked', checkedOn: '2026-10-06' },
} satisfies Record<string, Omit<ExerciseMediaEntry, 'illustrationRights' | 'videoReview'>>;
export const exerciseMedia: Readonly<Record<string, ExerciseMediaEntry>> = Object.freeze(Object.fromEntries(
 Object.entries(entries).map(([id, entry]) => [id, Object.freeze({
  ...entry,
  source: Object.freeze(entry.source),
  video: Object.freeze(entry.video),
  illustrationRights: Object.freeze({ status: 'project-original' as const, notice: '/media/NOTICE.md' as const, professionalReview: 'not-reviewed' as const }),
  videoReview: Object.freeze({ content: 'not-reviewed' as const, playback: 'videoId' in entry ? 'not-verified' as const : 'no-video' as const, reuseLicense: 'not-verified' as const }),
 })]),
));
export function getExerciseMedia(exerciseId: string): ExerciseMediaEntry | undefined {
 return Object.hasOwn(exerciseMedia, exerciseId) ? exerciseMedia[exerciseId] : undefined;
}
const videoIds = new Set(['nfX7IFK9UNI', 'm0GcZ24pK6k', '4PR9GedBrZY', 'P3FR4GUl2QM']);
export function youtubeEmbedUrl(videoId: string): string | undefined {
 return videoIds.has(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0` : undefined;
}
