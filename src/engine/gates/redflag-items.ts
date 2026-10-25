import type { Rules } from '../data';

/** Area-specific red-flag lists, in the order their questions are asked. Every area also gets redflag.joint_any. */
const AREA_RULES = ['back', 'shoulder', 'hip', 'ankle', 'neck'] as const;
const ITEM_FIELDS = ['emergency_items', 'urgent_items', 'cardiac_route_items', 'prompt_medical_items'] as const;
/** Most urgent first; within a tier the first matching rule decides the copy (back keeps its original precedence). */
const TIERS: readonly (readonly [string, readonly string[]])[] = [
  ['emergency_items', ['back', 'hip', 'neck']],
  ['cardiac_route_items', ['shoulder', 'neck']],
  ['prompt_medical_items', ['ankle']],
  ['urgent_items', ['back']],
  ['prompt_medical_items', ['shoulder']],
];
const items = (value: Record<string, unknown>, field: string) => (value[field] as string[] | undefined) ?? [];
const actionOf = (field: string) =>
  field === 'cardiac_route_items' ? 'cardiac_action' : field.replace(/_items$/, '_action');
const copyOf = (action: unknown) =>
  ((action as string[] | undefined) ?? []).find(step => step.startsWith('show_copy_'))!.slice('show_copy_'.length);

/** Ordered question keys for the reported areas. Neck alone asks only its two general items (redflag.neck.joint_items). */
export function redFlagQuestionKeys(rules: Rules, areas: readonly string[]): string[] {
  const joint = rules.get('redflag.joint_any').items as string[],
    neckOnly = areas.length > 0 && areas.every(area => area === 'neck'),
    neckJoint = items(rules.get('redflag.neck'), 'joint_items');
  const keys = neckOnly ? joint.filter(key => neckJoint.includes(key)) : [...joint];
  for (const area of AREA_RULES)
    if (areas.includes(area)) {
      const value = rules.get(`redflag.${area}`);
      for (const field of ITEM_FIELDS) keys.push(...items(value, field));
    }
  return [...new Set(keys)];
}

/** Every question key any area can ask. */
export function knownRedFlagKeys(rules: Rules): string[] {
  return redFlagQuestionKeys(rules, AREA_RULES);
}

/** Rule and copy for positive answers: emergency, then cardiac, then a medical prompt. */
export function redFlagRoute(
  rules: Rules,
  positive: readonly string[],
): { ruleId: string; copyId: string } | undefined {
  if (!positive.length) return undefined;
  for (const [field, areas] of TIERS)
    for (const area of areas) {
      const value = rules.get(`redflag.${area}`);
      if (items(value, field).some(key => positive.includes(key)))
        return { ruleId: `redflag.${area}`, copyId: copyOf(value[actionOf(field)]) };
    }
  return { ruleId: 'redflag.joint_any', copyId: copyOf(rules.get('redflag.joint_any').action) };
}
