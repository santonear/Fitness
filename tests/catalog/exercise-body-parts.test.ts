import { expect, it } from 'vitest';
import { catalogMetadata, exerciseBodyPart } from '../../src/catalog/registry';
import { getExerciseTags } from '../../src/catalog/exercise-guide';
const id = (slug: string) => [...catalogMetadata.values()].find(row => row.slug === slug)!.id;
it('labels hip bridges, thrusts, abductions and clamshells as glutes from primary muscles', () => {
  for (const slug of [
    'glute-bridge',
    'single-leg-glute-bridge',
    'banded-glute-bridge',
    'barbell-glute-bridge',
    'stability-ball-hip-bridge',
    'hip-thrust',
    'smith-machine-hip-thrust',
    'hip-abduction',
    'clamshells',
    'side-lying-hip-abduction',
    'cable-kickback',
  ]) {
    expect(exerciseBodyPart(id(slug)), slug).toBe('glutes');
    expect(getExerciseTags(id(slug)).bodyParts).toContain('glutes');
  }
});
it('does not relabel compound, chest, spinal or arm work based on a shared name', () => {
  for (const [slug, part] of [
    ['bodyweight-squat', 'upper-legs'],
    ['one-arm-kettlebell-floor-glute-bridge-press', 'chest'],
    ['thoracic-bridge', 'core'],
    ['tricep-kickback', 'upper-arms'],
    ['banded-standing-curl', 'upper-legs'],
  ])
    expect(exerciseBodyPart(id(slug)), slug).toBe(part);
});
