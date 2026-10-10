import core from './generated/core.json' with { type: 'json' };
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
  {
    id: EXERCISE_IDS.selfResistedRow, catalogVersion: CATALOG_VERSION,
    name: { zh: '自阻力划船', en: 'Self-resisted Row' }, category: 'bodyweight', equipment: 'none',
    metricType: 'reps', allowedMetrics: ['reps'],
    steps: { zh: ['一手轻握另一侧手腕，保持躯干稳定。', '屈肘向后拉，另一只手施加轻微阻力；左右交替，使用舒适的幅度。'], en: ['Gently hold one wrist with the opposite hand, keeping the torso steady.', 'Draw the elbow back against light resistance from the other hand. Alternate sides through a comfortable range.'] },
    cautions: { zh: ['不憋气，不猛拉；有肩、手腕或腰背不适时不安排此动作。'], en: ['Breathe normally and avoid jerking. Do not select this movement with shoulder, wrist or back discomfort.'] },
  },
  ...core.filter(item => !Object.values(EXERCISE_IDS).includes(item.id as typeof EXERCISE_IDS[keyof typeof EXERCISE_IDS])),
].map((exercise) => exerciseSchema.parse(exercise));
