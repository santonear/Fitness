import type { EngineProfile, GateState } from '../contracts';
import { Rules } from '../data';
import { gateState } from './state';

export type SafetyState = GateState;
/** The safety state the legacy source targets (progression/legacy-*) read: the live gate itself. */
export const safety = (profile: EngineProfile, rules: Rules): SafetyState => gateState(profile, rules);
