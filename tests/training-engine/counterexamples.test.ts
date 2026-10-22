import { describe, expect, it } from 'vitest';
import { classify } from '../../tools/eval/training-engine-audit';
import { enginePlanSchema, engineProfileSchema } from '../../src/engine/contracts';
import baseline from '../../tools/eval/training-engine-baseline.json';

describe('minimal real counterexamples retained from the 2000-profile audit', () => {
  for (const code of [
    'contract_shape',
    'duplicate_ladder',
    'session_volume_cap',
    'exercise_set_floor',
    'stretch_hold_cap',
  ])
    it(`does not reintroduce ${code}`, () => {
      const example = (baseline.counterexamples as Record<string, { index: number; profile: unknown }>)[code];
      expect(example).toBeDefined();
      const profile = engineProfileSchema.parse(example.profile),
        result = classify(profile);
      expect(result.status).not.toBe('throws');
      if (result.status === 'throws') throw Error(result.error);
      enginePlanSchema.parse(result.plan);
      expect(result.issues.filter(issue => issue.code === code)).toEqual([]);
      // Other infeasibility diagnostics remain visible in the full strict quality test.
    });
});
