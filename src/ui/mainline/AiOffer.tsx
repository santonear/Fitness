import { useEffect, useRef, useState } from 'react';
import { accessReason } from '../../application/ai-access';
import { pendingPainReviews } from '../../application/pain-events';
import { planStartDate } from '../../application/plan-presentation';
import { readTrialReceipt } from '../../ai/trial-recovery';
import { DEFAULT_TIME_ZONE, todayIn, weekStart } from '../../domain/local-date';
import { aiActivationCopy } from '../../i18n/features/coach/activation';
import { AiActivationSheet } from '../components/AiActivationSheet';
import { Toast } from '../components/common/Toast';
import { trialApi, type Application } from '../components/trial/trial-api';
import { useAccessStatus } from '../useAccessStatus';
import { useFeature } from '../useFeature';
import type { OrbProps } from '../components/Orb';
import { useMainline } from './context';
import { NUDGES_CHANGED, dismissNudges, markNudge, pickNudge, readNudges, writeNudges } from './ai-nudge';

/**
 * AI 助手芽芽 offers (V9.22): the orb's panel card while AI is off, the activation sheet, and at most one
 * nudge a week (first weekly review, a plan that does not fit). Nothing is sent; every step is a tap.
 */
export function useAiOffer(pathname: string) {
  const c = useMainline(),
    { data, locale } = c,
    copy = aiActivationCopy[locale];
  const enabled = useFeature('aiAssistantV2');
  const access = useAccessStatus(enabled);
  const off = enabled && !!access.status && accessReason(access.status) === 'invalid';
  const [nudges, setNudges] = useState(readNudges);
  const [notice, setNotice] = useState<string>();
  const [approved, setApproved] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const wasOff = useRef(off);
  const today = todayIn(data?.profile?.timeZone ?? DEFAULT_TIME_ZONE);
  useEffect(() => {
    const reload = () => setNudges(readNudges());
    reload();
    window.addEventListener(NUDGES_CHANGED, reload);
    return () => window.removeEventListener(NUDGES_CHANGED, reload);
  }, [pathname]);
  // An approved trial request still has to be claimed: 芽芽 says so on the orb until it is.
  useEffect(() => {
    const receipt = off ? readTrialReceipt() : '';
    if (!receipt) return setApproved(false);
    let alive = true;
    trialApi<Application[]>('trial/applications', { receipt })
      .then(apps => {
        if (alive) setApproved(apps.some(app => app.state === 'approved' && (app.claimUntil ?? 0) > Date.now()));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [off]);
  useEffect(() => {
    if (wasOff.current && access.status && !off) setNotice(copy.ready);
    if (access.status) wasOff.current = off;
  }, [off, access.status, copy.ready]);
  const quiet = !!nudges.dismissedUntil && nudges.dismissedUntil > today;
  const state = data?.state;
  const nudge =
    data?.version && enabled
      ? pickNudge(
          {
            route:
              pathname === '/review'
                ? 'review'
                : pathname === '/' || pathname.startsWith('/plans')
                  ? 'plan-home'
                  : 'other',
            today,
            paused:
              !!state?.trainingPause ||
              !!state?.cardiacPause ||
              !!state?.postpartumSafety?.urgentAt ||
              pendingPainReviews(data.workouts).length > 0,
            workouts: data.workouts,
            weeklyTarget: data.version.weeklyTarget,
            planStart: planStartDate(data.version, data.profile?.timeZone ?? DEFAULT_TIME_ZONE),
          },
          nudges,
        )
      : undefined;
  useEffect(() => {
    if (!nudge || nudges.week === weekStart(today)) return;
    const next = markNudge(nudges, nudge, today);
    writeNudges(next);
    setNudges(next);
  }, [nudge, nudges, today]);
  const openActivation = () => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    c.setActivationOpen(true);
  };
  const orb: Pick<OrbProps, 'tip' | 'tipKey' | 'offer'> =
    off && !quiet && approved
      ? { tip: copy.card, tipKey: 'ai-approved' }
      : nudge
        ? { tip: copy[nudge], tipKey: `ai-${nudge}` }
        : {};
  if (off && !quiet)
    orb.offer = {
      text: copy.card,
      dismiss: copy.dismiss,
      onGo: openActivation,
      onDismiss: () => {
        const next = dismissNudges(readNudges(), today);
        writeNudges(next);
        setNudges(next);
        setNotice(copy.dismissed);
      },
    };
  const elements = (
    <>
      <AiActivationSheet
        open={c.activationOpen}
        onClose={() => c.setActivationOpen(false)}
        triggerRef={trigger}
        locale={locale}
        onApplied={() => {
          c.setActivationOpen(false);
          setNotice(copy.applied);
        }}
      />
      <Toast message={notice ?? null} duration={4000} onDismiss={() => setNotice(undefined)} />
    </>
  );
  return { orb, openActivation, elements };
}
