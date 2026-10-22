import type { EngineProfile } from '../../src/engine/contracts';
import { Rules } from '../../src/engine/data';
import { generatePlan } from '../../src/engine/pipeline';
import { modifyPlan } from '../../src/engine';
/** Legacy test adapter pending M3 semantic migration; no certification is applied.
 * The public modification API must still classify every original hard error.
 * This creates no persisted data or application eligibility bypass. */
export function sourceCandidateFixture(profile: EngineProfile) {
  const rules = new Rules(),
    raw = generatePlan(profile, { rules });
  return modifyPlan(raw, profile, []).value;
}
