import { useRef, useState } from 'react';
import { accessReason } from '../../../application/ai-access';
import { planModeCopy } from '../../../i18n/features/onboarding/plan-mode';
import { useAccessStatus } from '../../useAccessStatus';
import { MorphPanel } from '../../components/common';
import { BigChoice, PrimaryButton, Yaya } from '../../components/kit';
import { TrialAccess } from '../../components/TrialAccess';

type PlanMode = 'ai' | 'local';
type AiReadiness = 'checking' | 'active' | 'needed' | 'disabled' | 'quota' | 'connection';

/** Server access state for the AI choice; only read while the AI option is selected. */
export function useAiReadiness(enabled: boolean): { readiness: AiReadiness; refresh: () => Promise<void> } {
  const access = useAccessStatus(enabled);
  if (!enabled || access.loading || (!access.status && !access.failed))
    return { readiness: 'checking', refresh: access.refresh };
  if (access.failed || !access.status) return { readiness: 'connection', refresh: access.refresh };
  const reason = accessReason(access.status);
  return {
    readiness:
      reason === 'invalid'
        ? 'needed'
        : reason === 'disabled'
          ? 'disabled'
          : reason === 'quota'
            ? 'quota'
            : reason === 'connection'
              ? 'connection'
              : 'active',
    refresh: access.refresh,
  };
}

/**
 * 芽芽 asks: AI-generated plan or the local plan. Choosing AI without access guides activation right here
 * (the existing trial/invitation flow in a sheet) instead of a dead end. Nothing is sent from this screen.
 */
export function PlanModeChoice({
  locale,
  value,
  onChange,
  busy,
  engineEnabled,
  readiness,
  onRefresh,
}: {
  locale: 'zh' | 'en';
  value?: PlanMode;
  onChange: (mode: PlanMode) => void;
  busy: boolean;
  engineEnabled: boolean;
  readiness: AiReadiness;
  onRefresh: () => Promise<void>;
}) {
  const t = planModeCopy[locale];
  const [activating, setActivating] = useState(false),
    trigger = useRef<HTMLElement | null>(null);
  const status = value === 'ai' ? readiness : undefined;
  return (
    <div className="v9-choices v9-plan-mode">
      <div className="v9-onboarding-yaya">
        <Yaya pose="wave" size={120} alt="" />
      </div>
      <div role="radiogroup" aria-label={t.title} className="v9-choices">
        <BigChoice
          label={t.ai}
          description={t.aiDescription}
          selected={value === 'ai'}
          disabled={busy}
          onClick={() => onChange('ai')}
        />
        <BigChoice
          label={t.local}
          description={t.localDescription}
          selected={value === 'local'}
          disabled={busy}
          onClick={() => onChange('local')}
        />
      </div>
      {status && (
        <div className="v9-plan-mode-status" role="status">
          <p>
            {status === 'checking'
              ? t.checking
              : status === 'active'
                ? t.active
                : status === 'needed'
                  ? t.needed
                  : status === 'disabled'
                    ? t.disabled
                    : status === 'quota'
                      ? t.quota
                      : t.connection}
          </p>
          {status === 'active' && engineEnabled && <p>{t.engineNote}</p>}
          {status === 'needed' && (
            <PrimaryButton
              tone="quiet"
              size="md"
              disabled={busy}
              onClick={event => {
                trigger.current = event.currentTarget;
                setActivating(true);
              }}
            >
              {t.activate}
            </PrimaryButton>
          )}
          {status === 'connection' && (
            <PrimaryButton tone="quiet" size="md" disabled={busy} onClick={() => void onRefresh()}>
              {t.retry}
            </PrimaryButton>
          )}
          {status !== 'active' && status !== 'checking' && (
            <PrimaryButton tone="text" size="md" disabled={busy} onClick={() => onChange('local')}>
              {t.useLocal}
            </PrimaryButton>
          )}
        </div>
      )}
      <MorphPanel
        open={activating}
        onClose={() => {
          setActivating(false);
          void onRefresh();
        }}
        triggerRef={trigger}
        title={t.activateTitle}
        closeLabel={locale === 'zh' ? '关闭' : 'Close'}
      >
        {activating && (
          <TrialAccess
            onContinue={() => {
              setActivating(false);
              void onRefresh();
            }}
            onSkip={() => {
              setActivating(false);
              onChange('local');
            }}
          />
        )}
      </MorphPanel>
    </div>
  );
}
