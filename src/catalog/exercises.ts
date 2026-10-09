import core from './generated/core.json';
import type { Exercise } from '../domain/models';
import { exerciseSchema } from '../domain/schemas';
import { EXERCISE_IDS } from './exercise-ids';

export { EXERCISE_IDS } from './exercise-ids';

export const CATALOG_VERSION = 1;
export const exercises: Exercise[] = [
  {
    id: EXERCISE_IDS.gobletSquat, catalogVersion: CATALOG_VERSION,
    name: { zh: '高脚杯深蹲', en: 'Goblet squat' }, category: 'strength', equipment: 'dumbbell',
    metricType: 'reps_load', allowedMetrics: ['reps', 'loadGrams'],
    steps: { zh: ['双手将哑铃持于胸前，双脚站稳。', '屈髋屈膝下蹲，再平稳站起。'], en: ['Hold a dumbbell at chest height with a stable stance.', 'Bend your hips and knees, then stand up steadily.'] },
    cautions: { zh: ['保持动作可控，选择能稳定完成的负重。'], en: ['Keep the movement controlled and use a load you can move steadily.'] },
  },
  {
    id: EXERCISE_IDS.walking, catalogVersion: CATALOG_VERSION,
    name: { zh: '步行', en: 'Walking' }, category: 'cardio', equipment: 'none',
    metricType: 'duration_distance', allowedMetrics: ['durationSeconds', 'distanceMeters'],
    steps: { zh: ['选择平坦且通畅的路线。', '以稳定步幅前行，记录时长和可选距离。'], en: ['Choose a clear, level route.', 'Walk at a steady pace and record time and optional distance.'] },
    cautions: { zh: ['留意路面和周围交通。'], en: ['Pay attention to the surface and nearby traffic.'] },
  },
  {
    id: EXERCISE_IDS.bodyweightSquat, catalogVersion: CATALOG_VERSION,
    name: { zh: '徒手深蹲', en: 'Bodyweight squat' }, category: 'bodyweight', equipment: 'none',
    metricType: 'reps', allowedMetrics: ['reps'],
    steps: { zh: ['双脚站稳，双臂前伸保持平衡。', '屈髋屈膝下蹲，再平稳站起。'], en: ['Stand steadily and extend your arms for balance.', 'Bend your hips and knees, then stand up steadily.'] },
    cautions: { zh: ['保持脚掌着地，使用能控制的动作幅度。'], en: ['Keep your feet planted and use a range you can control.'] },
  },
  {
    id: EXERCISE_IDS.plank, catalogVersion: CATALOG_VERSION,
    name: { zh: '平板支撑', en: 'Plank' }, category: 'bodyweight', equipment: 'none',
    metricType: 'duration', allowedMetrics: ['durationSeconds'],
    steps: { zh: ['以前臂和脚尖支撑身体。', '保持躯干稳定，记录保持时长。'], en: ['Support your body on your forearms and toes.', 'Keep your torso steady and record the hold duration.'] },
    cautions: { zh: ['保持呼吸，不强行延长已无法稳定的支撑。'], en: ['Keep breathing and end the hold when you can no longer stay steady.'] },
  },
  ...core.filter(item => !Object.values(EXERCISE_IDS).includes(item.id as typeof EXERCISE_IDS[keyof typeof EXERCISE_IDS])),
].map((exercise) => exerciseSchema.parse(exercise));
