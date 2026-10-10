import { coachEvaluationFixture } from '../../src/backend/coach-evaluation-fixtures';
import { confirmationFor, type CoachEnvelope } from '../../src/backend/contracts';
export const currentCoachRefusal = {requestId:'11111111-1111-4111-8111-111111111111',restoreGeneration:0,mutationAllowed:false,type:'refused',reason:'Synthetic boundary response'};
export async function currentCoachEnvelope(locale:'en'|'zh'='en'):Promise<CoachEnvelope> {
  const coach = coachEvaluationFixture('onboard-plan',locale);
  coach.sendConfirmation = await confirmationFor(coach);
  const base = {contractVersion:1 as const,operation:'generate' as const,requestId:coach.requestId,locale,restoreGeneration:0,goalText:'synthetic goal',coach};
  return {...base,sendConfirmation:await confirmationFor(base)};
}
