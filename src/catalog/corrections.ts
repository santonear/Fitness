import type { Exercise } from '../domain/models';

// Application-owned errata overlay. The hash-pinned provider archive stays intact.
// The supplied document says 23 but enumerates these 25 distinct slugs.
export const catalogCorrections: Record<
  string,
  { equipment?: string; name?: { zh: string; en: string }; steps?: { zh: string[]; en: string[] } }
> = {
  'back-extension': { equipment: 'back-extension-machine' },
  'bench-dips': { equipment: 'flat-bench' },
  'bench-leg-pull-in': { equipment: 'flat-bench' },
  'box-squat': { equipment: 'flat-bench' },
  'captains-chair-knee-raise': { equipment: 'dip-station' },
  'captains-chair-leg-raise': { equipment: 'dip-station' },
  'decline-crunch': { equipment: 'adjustable-bench' },
  'decline-push-up': { equipment: 'flat-bench' },
  'deficit-push-ups': { equipment: 'parallettes' },
  'donkey-calf-raise': { equipment: 'flat-bench' },
  'dragon-flag': { equipment: 'flat-bench' },
  'incline-push-ups': { equipment: 'flat-bench' },
  'single-leg-calf-raise': { equipment: 'box-or-step' },
  'step-ups': { equipment: 'box-or-step' },
  'decline-bench-press': { equipment: 'barbell' },
  'kettlebell-farmers-walk': {
    steps: {
      zh: [
        '双手各提一只壶铃，双臂自然垂在身体两侧。',
        '保持躯干稳定，沿平坦通畅的路线缓慢行走。',
        '结束后站稳，再控制着放下壶铃。',
      ],
      en: [
        'Hold a kettlebell in each hand with arms resting by your sides.',
        'Keep your torso steady and walk slowly along a clear level route.',
        'Stand steadily before lowering the kettlebells with control.',
      ],
    },
  },
  'human-flag': { equipment: 'vertical-pole' },
  'close-grip-lat-pulldown': { equipment: 'lat-pulldown-machine' },
  'lat-pulldown': { equipment: 'lat-pulldown-machine' },
  'one-arm-lat-pulldown': { equipment: 'lat-pulldown-machine' },
  'reverse-grip-lat-pulldown': { equipment: 'lat-pulldown-machine' },
  'doorway-chest-stretch': {
    equipment: 'wall',
    steps: {
      zh: [
        '站在牢固门框旁，将一侧前臂轻放在门框上，肘略低于肩。',
        '身体缓慢向前移，直到胸前有轻微牵拉感。',
        '保持自然呼吸，缓慢退出拉伸，再换侧。',
      ],
      en: [
        'Stand beside a solid doorway and rest one forearm on the frame with elbow slightly below shoulder height.',
        'Shift forwards slowly until you feel a gentle chest stretch.',
        'Breathe normally, ease out of the stretch, and change sides.',
      ],
    },
  },
  'straight-bar-dips': {
    equipment: 'dip-station',
    steps: {
      zh: [
        '在带直杆的牢固支撑站上方用双手撑起身体，手臂伸直但不锁死。',
        '屈肘缓慢下移到可控幅度。',
        '伸臂推回起点；不要从悬垂姿势直接拉起。',
      ],
      en: [
        'Support yourself above a secure straight-bar station with arms straight but not locked.',
        'Bend your elbows to lower through a controlled range.',
        'Press back to the start; do not begin from a dead hang.',
      ],
    },
  },
  'bodyweight-overhead-press': {
    name: { zh: '派克俯卧撑', en: 'Pike push-up' },
    steps: {
      zh: ['双手与双脚撑地，抬高髋部形成倒 V 形。', '屈肘让头部缓慢靠近地面。', '伸臂推回起点，始终保持动作可控。'],
      en: [
        'Support yourself on hands and feet and lift your hips into an inverted V.',
        'Bend your elbows to lower your head towards the floor.',
        'Press back to the start with control.',
      ],
    },
  },
  'band-assisted-pull-ups': { equipment: 'resistance-band' },
};

export function applyCatalogCorrection(exercise: Exercise, slug: string): Exercise {
  const correction = catalogCorrections[slug];
  return correction ? ({ ...exercise, ...correction } as Exercise) : exercise;
}
