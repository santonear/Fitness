import { engineProfileSchema } from '../../src/engine/contracts';
import inputs from './v1-sampled-inputs.json';
/** Frozen input only: no V1 plan label, repair proof or eligibility exemption is applied. */
export function legacySampledProfile(index: number) {
  const row = inputs.profiles.find(row => row.index === index);
  if (!row) throw Error(`Missing frozen source input ${index}`);
  return engineProfileSchema.parse(structuredClone(row.profile));
}
