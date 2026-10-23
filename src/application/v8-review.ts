import type { Repository } from '../persistence/repository';
import type { ReviewSuggestion } from './review/contracts';
import { createV8Workflow } from './v8-workflow';

/** Adopting a review suggestion uses the workflow's validated plan-change path (safety, health limits, engine). */
export function createReviewService(repo: Repository) {
  return {
    adopt: (suggestion: ReviewSuggestion, expectedRevision: number, generation: number, summary: string) =>
      createV8Workflow(repo).adoptReviewSuggestion(suggestion, expectedRevision, generation, summary),
  };
}
