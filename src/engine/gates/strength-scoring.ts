import type { EngineProfile, GateState } from "../contracts";
import { Rules } from "../data";
import { gateState } from "./state";

export type SafetyState = GateState;
/**
 * The pre-migration safety view: the live gate without its later evidence gates. Legacy source
 * targets (progression/legacy-*) still read it, and the A migration test uses it as the baseline
 * that runGates must strictly extend. See GateStateOptions.legacyScoring for the exact gap.
 */
export function safety(profile: EngineProfile, rules: Rules): SafetyState {
  return gateState(profile, rules, { legacyScoring: true });
}
