import type { EngineProfile, RuleTrace } from '../contracts';
import { Rules, type Exercise } from '../data';
import { sharedEligibility } from '../candidates/eligibility';
import type { SafetyState } from '../gates/strength-scoring';

export interface SelectionContext {
  profile: EngineProfile;
  rules: Rules;
  safety: SafetyState;
  seed: string;
  trace: RuleTrace[];
  used: Set<string>;
  ladders: Set<string>;
  previous?: Set<string>;
  excluded?: Set<string>;
}

export function hardEligible(e: Exercise, ctx: SelectionContext): boolean {
  if (ctx.excluded?.has(e.id)) return false;
  const cached = ctx.safety.eligibility.get(e.id);
  if (cached !== undefined) return cached;
  const result = sharedEligibility(e, ctx, true);
  ctx.safety.eligibility.set(e.id, result);
  return result;
}

export function mobilityRegions(e: Exercise | undefined, r: Rules): string[] {
  if (!e || e.modality !== 'mobility') return [];
  const regions = new Set<string>();
  if (e.mobility_type === 'static')
    for (const group of e.stretch_targets ?? []) {
      if (['quads', 'glutes', 'hamstrings'].includes(group)) regions.add('lower_body');
      if (['chest', 'back', 'shoulders'].includes(group)) regions.add('upper_body');
    }
  if (
    e.mobility_type === 'dynamic' &&
    (e.primaryMuscles ?? []).some(m => ['core', 'lower_back'].includes(r.get('dose.muscle_groups').catalog_map[m]))
  )
    regions.add('trunk');
  return [...regions];
}
