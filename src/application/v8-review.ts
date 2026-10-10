import type { Repository } from '../persistence/repository';
import type { ReviewSuggestion } from './review/contracts';
import { v8PlanVersionSchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';

export function createReviewService(repo: Repository) {
 return { adopt: (suggestion: ReviewSuggestion, expectedRevision: number, generation: number, summary: string) => repo.write(async()=>{
  const meta=await repo.readMetadata(),state=await repo.db.v8State.get('v8');
  const plan=state?.currentPlanId?await repo.db.v8Plans.get(state.currentPlanId):undefined;
  if((meta.restoreGeneration??0)!==generation||!plan||plan.readOnly||plan.currentVersionId!==suggestion.basedOnVersionId)throw new DomainError('CONFLICT','STALE_REVIEW');
  const previous=await repo.db.v8PlanVersions.get(plan.currentVersionId);
  if(!previous)throw new DomainError('INVALID','MISSING_VERSION');
  const {reasons:_reasons,...proposal}=suggestion.proposal;
  const version=v8PlanVersionSchema.parse({...proposal,id:crypto.randomUUID(),planId:plan.id,versionNumber:previous.versionNumber+1,createdAt:new Date().toISOString(),origin:'review_suggestion',changeSummary:[summary],basedOnVersionId:previous.id});
  await repo.db.v8PlanVersions.add(version);await repo.db.v8Plans.put({...plan,currentVersionId:version.id});
  return version;
 },expectedRevision) };
}
