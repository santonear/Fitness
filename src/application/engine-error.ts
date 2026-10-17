import {DomainError} from '../domain/errors';
import type {EnginePlan} from '../engine/contracts';
/** Carries only a local, non-actionable result for the UI; never a save candidate. */
export class EnginePlanUnavailableError extends DomainError{
 constructor(public readonly plan:EnginePlan){super('INVALID','ENGINE_PLAN_UNAVAILABLE');this.name='EnginePlanUnavailableError';}
}
