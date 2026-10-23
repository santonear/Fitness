import { pendingPainReviews, historyDangerReview } from '../../application/pain-events';
import { unresolvedReview } from '../../application/training-pain';
import { EngineProfilePage } from '../pages/settings/EngineProfilePage';
import { useState, useRef } from 'react';
import { assistantPlanIntentDuringWorkout, buildCoachRequest } from '../../coach/request-builder';
import { bodyProfileService } from '../../application/body-profile';
import { useFeature } from '../useFeature';
import { BodyProfilePage } from '../pages/settings/BodyProfilePanel';
import { bodyCopy } from '../../i18n/features/onboarding/body';
import { MaintenanceBanner } from '../admin/finance/MaintenanceBanner';
import { planLifecycleCopy } from '../../i18n/features/plan/lifecycle';
import { Toast } from '../components/common/Toast';
import { RestoreBoundary } from './RestoreBoundary';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from '../../themes/ThemeProvider';
import { MainlineProvider, useMainline, workflow } from './context';
import { localProfile } from '../../application/rules/local-profile';
import { Button, MorphPanel } from '../components/common';
import { PrimaryButton } from '../components/kit';
import { replanCopy } from '../../i18n/features/plan/training-days';
import { scheduleAfterProposal } from '../../application/picked-schedule';
import { TrialAccess } from '../components/TrialAccess';
import { CoachPanel } from '../components/CoachPanel';
import { CoachVisual } from '../components/CoachVisual';
import { Orb, type OrbContext } from '../components/Orb';
import { V8Reminder } from '../components/V8Reminder';
import { path, OnboardingRoute, DraftRoute } from './OnboardingRoutes';
import { ExercisesPage } from '../pages/plan/ExercisesPage';
import { PlanRoute } from '../pages/plan/PlanRoute';
import { FocusPage } from '../pages/plan-upgrade/FocusPage';
import { LetterStep } from '../pages/onboarding/LetterStep';
import { FitnessTestPage } from '../pages/settings/FitnessTestPage';
import { CalmPage } from '../pages/plan-upgrade/CalmPage';
import { ActivityPage } from '../pages/training/ActivityPage';
import { HomePage } from '../pages/home/HomePage';
import { navCopy } from '../../i18n/features/home/nav';
import { WorkoutPage } from '../pages/training/WorkoutPage';
import { FinishPage } from '../pages/training/FinishPage';
import { ManualPage } from '../pages/training/ManualPage';
import { ReviewPage } from '../pages/review/ReviewPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { AppearancePage } from '../pages/settings/AppearancePage';
import { NutritionAdvicePage } from '../pages/nutrition/NutritionAdvicePage';
import { MyChangesPage } from '../pages/settings/MyChangesPage';
import { CaloriePage, MacroPage } from '../pages/settings/EnergyPages';
import { orbContextCopy, orbCopy } from '../../i18n/features/coach/orb';
import { ActivityImportPage } from '../pages/settings/ActivityImportPage';
import '../theme.css';
import './mainline.css';
const orbContext = (pathname: string): OrbContext =>
  pathname === '/'
    ? 'home'
    : pathname.startsWith('/plans')
      ? 'plan'
      : pathname === '/review'
        ? 'review'
        : pathname.startsWith('/settings')
          ? 'settings'
          : pathname.endsWith('/finish')
            ? 'finish'
            : 'other';
function Shell() {
  const c = useMainline();
  const { data, t, slots, navigate, error } = c,
    location = useLocation();
  const [versionUndo, setVersionUndo] = useState<{
    planId: string;
    appliedVersionId: string;
    priorVersionId: string;
    expectedRevision: number;
    versionNumber: number;
    expiresAt: number;
  }>();
  const immersive =
    ['/onboarding', '/plan-draft', '/letter'].includes(location.pathname) || location.pathname.startsWith('/workout/');
  const engineEnabled = useFeature('trainingEngine' as Parameters<typeof useFeature>[0]);
  const reviewing = location.pathname === path('review'),
    bodyEnabled = useFeature('bodyProfile');
  const replanTrigger = useRef<HTMLElement | null>(null);
  const optionalOnboardingProfile = () => {
    try {
      return localProfile(c.answers);
    } catch {
      return undefined;
    }
  };
  /** 芽芽 orb: same task routing as the former floating launcher; quick actions prefill the composer. */
  const openFromOrb = (prompt?: string) => {
    if (!data) return;
    const home = location.pathname === path('next') && !!data.version;
    const [task, profile] =
      location.pathname === path('draft') && c.candidate
        ? ['ONBOARD_PLAN' as const, c.candidate.profile]
        : location.pathname === path('onboarding')
          ? ['ONBOARD_PLAN' as const, optionalOnboardingProfile()]
          : location.pathname === path('review')
            ? ['PERIOD_REVIEW' as const, undefined]
            : home
              ? ['ADJUST_TODAY' as const, undefined]
              : [data.version ? ('MODIFY_PLAN' as const) : ('ONBOARD_PLAN' as const), optionalOnboardingProfile()];
    const templateId = task === 'ADJUST_TODAY' ? c.homeTemplateId : undefined;
    if (prompt) c.openCoachWithDraft(prompt, task, profile, templateId);
    else c.openCoach(task, templateId, profile);
  };
  if (!data)
    return (
      <main className="v8-shell">
        <p role="status">{error || t.loading}</p>
      </main>
    );
  const healthEntry =
    engineEnabled ||
    !!data.state?.pregnancySafety?.providerPause ||
    !!data.state?.pregnancySafety?.supineAvoidSince ||
    !!data.state?.olderSafety?.reviewRequiredAt ||
    !!data.state?.cardiacPause ||
    !!data.state?.postpartumSafety?.urgentAt ||
    !!data.state?.postpartumSafety?.regression ||
    !!data.state?.trainingPause ||
    pendingPainReviews(data.workouts).length > 0 ||
    unresolvedReview(historyDangerReview(data.workouts, data.state?.coachProfile?.screening?.redFlagReview));
  return (
    <div
      className="v8-shell"
      data-immersive={immersive}
      data-training-active={location.pathname.startsWith('/workout/') && !location.pathname.endsWith('/finish')}
    >
      {bodyEnabled &&
        data.profile?.bodyDetails?.source === 'migrated' &&
        !data.profile.bodyDetails.confirmedAt &&
        location.pathname !== '/settings/body' && (
          <aside>
            <p>{bodyCopy[c.locale].migrated}</p>
            <Button onClick={() => navigate('/settings/body')}>{bodyCopy[c.locale].settingsTitle}</Button>
          </aside>
        )}
      <MaintenanceBanner training={location.pathname.startsWith('/workout/')} language={c.locale} />
      {reviewing && (
        <header className={`v8-shell-header${reviewing ? ' v8-review-header' : ''}`}>
          <slots.BrandMark label={t.brand} />
          {reviewing && (
            <Button className="v8-review-coach" aria-label={t.askCoach} onClick={() => c.openCoach('PERIOD_REVIEW')}>
              <CoachVisual />
            </Button>
          )}
        </header>
      )}
      {error && !['/onboarding', '/plan-draft'].includes(location.pathname) && <p role="alert">{error}</p>}
      <Routes>
        <Route
          path="/settings/engine"
          element={healthEntry ? <EngineProfilePage /> : <Navigate to="/settings" replace />}
        />
        <Route
          path="/settings/body"
          element={bodyEnabled || data.profile?.bodyDetails ? <BodyProfilePage /> : <Navigate to="/settings" replace />}
        />
        <Route path="/settings/nutrition" element={<NutritionAdvicePage />} />
        <Route path="/nutrition" element={<NutritionAdvicePage />} />
        <Route path="/settings/changes" element={<MyChangesPage />} />
        <Route path="/settings/calories" element={<CaloriePage />} />
        <Route path="/settings/macros" element={<MacroPage />} />
        <Route path="/settings/import" element={<ActivityImportPage />} />
        <Route
          path="/trial"
          element={
            <main>
              <TrialAccess onStartPlanning={c.restartPlanning} />
              <Button onClick={() => navigate('/settings')}>{t.back}</Button>
            </main>
          }
        />
        <Route path="/ai" element={<Navigate to="/onboarding" replace />} />
        <Route path={path('exercises')} element={<ExercisesPage />} />
        <Route path={path('plan')} element={<PlanRoute />} />
        <Route path={path('versions')} element={<PlanRoute versions />} />
        <Route path={path('activity')} element={<ActivityPage />} />
        <Route path={path('onboarding')} element={<OnboardingRoute />} />
        <Route path={path('draft')} element={<DraftRoute />} />
        <Route path={path('next')} element={<HomePage />} />
        <Route path={path('focus')} element={<FocusPage />} />
        <Route path={path('journey')} element={<Navigate to="/settings" replace />} />
        <Route
          path="/letter"
          element={<LetterStep locale={c.locale} onDone={() => navigate('/', { state: { applied: true } })} />}
        />
        <Route path="/settings/fitness-test" element={<FitnessTestPage />} />
        <Route path={path('calm')} element={<CalmPage />} />
        <Route path={path('workout')} element={<WorkoutPage />} />
        <Route path={path('finish')} element={<FinishPage />} />
        <Route path="/manual" element={<ManualPage />} />
        <Route path={path('review')} element={<ReviewPage />} />
        <Route path={path('settings')} element={<SettingsPage />} />
        <Route path={path('appearance')} element={<AppearancePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      {!immersive && location.pathname !== '/activity' && location.pathname !== '/manual' && (
        <V8Reminder chatOpen={c.coachOpen} locale={c.locale} onStart={() => navigate('/')} />
      )}
      {(!location.pathname.startsWith('/workout/') || location.pathname.endsWith('/finish')) &&
        location.pathname !== '/activity' &&
        location.pathname !== '/manual' && (
          <Orb
            locale={c.locale}
            context={orbContext(location.pathname)}
            actions={
              orbContext(location.pathname) === 'home'
                ? [
                    ...orbContextCopy[c.locale].home.actions.map(label => ({ label })),
                    { label: orbCopy[c.locale].nutrition, onSelect: () => navigate('/settings/nutrition') },
                  ]
                : undefined
            }
            autoTuck={immersive}
            onOpenChat={() => openFromOrb()}
            onAction={prompt => openFromOrb(prompt)}
          />
        )}
      <Toast
        key={c.deletedNotice?.expiresAt}
        message={c.deletedNotice ? planLifecycleCopy[c.locale].deleted : null}
        duration={c.deletedNotice ? Math.max(0, c.deletedNotice.expiresAt - Date.now()) : 10000}
        onDismiss={() => c.setDeletedNotice(undefined)}
        action={
          c.deletedNotice
            ? { label: planLifecycleCopy[c.locale].undo, onClick: () => void c.undoPlan(), disabled: c.busy }
            : undefined
        }
      />
      <Toast
        key={versionUndo?.expiresAt}
        message={
          versionUndo
            ? c.locale === 'zh'
              ? `已更新到第 ${versionUndo.versionNumber} 版`
              : `Updated to version ${versionUndo.versionNumber}`
            : null
        }
        duration={versionUndo ? Math.max(0, versionUndo.expiresAt - Date.now()) : 10000}
        onDismiss={() => setVersionUndo(undefined)}
        action={
          versionUndo
            ? {
                label: c.locale === 'zh' ? '撤销' : 'Undo',
                onClick: () => {
                  if (!versionUndo || Date.now() >= versionUndo.expiresAt) return;
                  void workflow
                    .undoAppliedCoachVersion({
                      planId: versionUndo.planId,
                      appliedVersionId: versionUndo.appliedVersionId,
                      priorVersionId: versionUndo.priorVersionId,
                      expectedRevision: versionUndo.expectedRevision,
                    })
                    .then(async () => {
                      setVersionUndo(undefined);
                      await c.reload();
                    })
                    .catch(() => setVersionUndo(undefined));
                },
                disabled: c.busy,
              }
            : undefined
        }
      />
      <MorphPanel
        open={c.replanAsk}
        onClose={() => c.setReplanAsk(false)}
        triggerRef={replanTrigger}
        title={replanCopy[c.locale].title}
        closeLabel={replanCopy[c.locale].cancel}
      >
        <p>{replanCopy[c.locale].hint}</p>
        <PrimaryButton onClick={c.startFresh}>{replanCopy[c.locale].confirm}</PrimaryButton>
      </MorphPanel>
      <CoachPanel
        draft={c.coachDraft}
        beforeSend={async request => {
          if (request.body) await bodyProfileService.validateSending(request.body);
        }}
        resolveRequest={(message, current) => {
          if (current.task !== 'ADJUST_TODAY' || !assistantPlanIntentDuringWorkout(message)) return current;
          return (
            buildCoachRequest({
              task: 'MODIFY_PLAN',
              data,
              conversationId: current.conversationId,
              instruction: message,
            }) ?? current
          );
        }}
        rememberOnApply={location.pathname !== path('draft')}
        onPreferencesChanged={async () => {
          const updated = await c.reload();
          c.refreshCoachContext(updated);
          setVersionUndo(previous =>
            previous ? { ...previous, expectedRevision: updated.metadata.dataRevision } : previous,
          );
        }}
        initialSend={c.coachInitialSend}
        locale={c.locale}
        unavailableReason={data.active && data.active.planVersionId !== data.version?.id ? t.oldWorkout : undefined}
        onActivate={() => {
          c.setCoachOpen(false);
          navigate('/trial');
        }}
        onLocalPlan={() => {
          c.setCoachOpen(false);
          navigate('/onboarding');
        }}
        onLocalReview={() => {
          c.setReviewKind('week');
          c.setCoachOpen(false);
          navigate('/review');
        }}
        open={c.coachOpen}
        onClose={() => c.setCoachOpen(false)}
        request={c.coachRequest}
        expectedRevision={c.coachRevision}
        triggerRef={c.coachTrigger}
        onApply={async candidate => {
          if (
            location.pathname === path('draft') &&
            candidate.request.task === 'ONBOARD_PLAN' &&
            candidate.response.type === 'plan_proposal' &&
            c.candidate
          ) {
            c.setCandidate({
              ...candidate.response,
              profile: c.candidate.profile,
              expectedRevision: c.candidate.expectedRevision,
              source: 'ai',
              enginePlan: candidate.enginePlan,
              ...scheduleAfterProposal(
                c.candidate,
                candidate.request,
                c.candidate.proposal,
                candidate.response.proposal,
              ),
            });
            c.setCoachOpen(false);
            navigate(path('draft'));
            return;
          }
          const previous = data.version;
          await workflow.applyCoachCandidate(candidate);
          const updated = await c.reload();
          c.refreshCoachContext(updated);
          if (previous && updated.version && updated.version.id !== previous.id && updated.plan)
            setVersionUndo({
              planId: updated.plan.id,
              appliedVersionId: updated.version.id,
              priorVersionId: previous.id,
              expectedRevision: updated.metadata.dataRevision,
              versionNumber: updated.version.versionNumber,
              expiresAt: Date.now() + 10000,
            });
          if (candidate.request.task === 'ONBOARD_PLAN') navigate('/');
        }}
      />
      {!immersive && (
        <nav aria-label={navCopy[c.locale].label} className="v9-tabbar">
          {(
            [
              ['next', 'training'],
              ['plan', 'plan'],
              ['review', 'review'],
              ['settings', 'me'],
            ] as const
          ).map(([id, kind]) => {
            const current = id === 'next' ? location.pathname === path(id) : location.pathname.startsWith(path(id));
            const label = navCopy[c.locale][kind];
            return (
              <button
                type="button"
                key={id}
                className="v9-tab v8-press"
                aria-current={current ? 'page' : undefined}
                onClick={() => navigate(path(id))}
              >
                <span className="v9-tab-icon" aria-hidden="true">
                  <slots.NavIcon kind={kind} selected={current} label={label} />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
export default function MainlineApp() {
  return (
    <ThemeProvider>
      <RestoreBoundary>
        <MainlineProvider>
          <Shell />
        </MainlineProvider>
      </RestoreBoundary>
    </ThemeProvider>
  );
}
