import type { Pattern } from '../contracts';

export const FOCUS: Record<string, Pattern[]> = {
  upper: ['push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical', 'isolation_upper'],
  lower: ['squat', 'lunge', 'hinge', 'isolation_lower'],
  core: ['anti_extension', 'anti_rotation', 'anti_lateral_flexion', 'rotation', 'trunk_flexion'],
  mobility: ['mobility'],
};
