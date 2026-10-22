/** One entry point for the training workflow; the pieces live in ./workflow/. */
import { createOlderSafety } from "./older-safety";
import { createWorkoutTimes } from "./workout-times";
import type { Repository } from "./../persistence/repository";
import { createTrainingFeedback } from "./training-feedback";
import { createTrainingPain } from "./training-pain";
import { createWorkflowContext } from "./workflow/context";
import { createPlanSetup, basicProposal } from "./workflow/plan-setup";
import { createWorkoutSession } from "./workflow/workout-session";
import { createPlanVersions } from "./workflow/plan-versions";

export { basicProposal };
export { START_DATE_WINDOW_DAYS, type LocalCandidate, type ManualSelection } from "./workflow/shared";

export function createV8Workflow(repo: Repository) {
  const ctx = createWorkflowContext(repo);
  const { postpartum, caution, pregnancy, postpartumReferral, birth, cardiac, checkins, lifecycle } = ctx;
  const { saveEngineSettings, snapshot, propose, adopt } = createPlanSetup(ctx);
  const { nextTargetPreview, start, recordSet, finish, replacementCandidates, substitute } = createWorkoutSession(ctx, { snapshot });
  const { applyCoachCandidate, undoAppliedCoachVersion, changeStartDate } = createPlanVersions(ctx, { adopt });
  const pain = createTrainingPain(repo);
  return {
    changeStartDate,
    correctWorkoutTimes: createWorkoutTimes(repo).correct,
    reviewCaution: caution.review,
    reportCautionMorning: caution.reportMorning,
    reconcileCaution: caution.reconcile,
    reportPostpartumReferral: postpartumReferral.report,
    reportBirth: birth.report,
    reportPregnancyStop: pregnancy.reportStop,
    reportPregnancySupine: pregnancy.reportSupine,
    confirmPregnancyProviderContacted: pregnancy.confirmProviderContacted,
    reportOlderFall: createOlderSafety(repo).report,
    answerOlderFall: createOlderSafety(repo).answer,
    confirmOlderFallProfessionalSeen:
      createOlderSafety(repo).confirmProfessionalSeen,
    reportCardiacSymptoms: cardiac.report,
    confirmCardiacClearance: cardiac.confirmClearance,
    reportPostpartumSymptoms: postpartum.report,
    confirmPostpartumProfessionalSeen: postpartum.confirmProfessionalSeen,
    ...lifecycle,
    replacementCandidates,
    snapshot,
    propose,
    adopt,
    saveEngineSettings,
    start,
    recordSet,
    finish,
    substitute,
    nextTargetPreview,
    saveTrainingCheckin: checkins.save,
    pendingTrainingCheckin: checkins.pending,
    painFeedbackPreview: pain.preview,
    applyPainFeedback: pain.apply,
    completePastPainReview: pain.completePastReview,
    confirmPainProfessionalSeen: pain.confirmProfessionalSeen,
    appendSetFeedback: createTrainingFeedback(repo).append,
    applyCoachCandidate,
    undoAppliedCoachVersion,
  };
}

