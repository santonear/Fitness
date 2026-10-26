import { AssistantPanel } from './AssistantPanel';
import { useFeature } from '../useFeature';
import { useAccessStatus } from '../useAccessStatus';
import { accessCopy } from '../../application/ai-access';
import { aiActivationCopy } from '../../i18n/features/coach/activation';
import type { EnginePlan } from '../../engine/contracts';
import type { RefObject } from 'react';
import type { SessionTemplate } from '../../domain/v8/contracts';
import type { CoachRequest, CoachResponse } from '../../coach/contracts';
export type CoachApplication = {
  enginePlan?: EnginePlan;
  request: CoachRequest;
  response: CoachResponse;
  expectedRevision: number;
};
export type CoachPanelProps = {
  beforeSend?: (request: CoachRequest) => Promise<void>;
  onPreferencesChanged?: () => Promise<void>;
  resolveRequest?: (message: string, request: CoachRequest) => CoachRequest | undefined;
  rememberOnApply?: boolean;
  open: boolean;
  localOnly?: boolean;
  applyLabel?: string;
  successLabel?: string;
  disableNutrition?: boolean;
  localFallbackOnError?: boolean;
  templateMinutes?: (template: SessionTemplate) => number;
  onClose: () => void;
  request?: CoachRequest;
  expectedRevision: number;
  initialSend?: { nonce: string; message: string; request: CoachRequest; expectedRevision: number };
  /** Prefills the composer once per nonce (芽芽 quick actions); the user still reviews and sends it. */
  draft?: { nonce: string; text: string };
  triggerRef?: RefObject<HTMLElement | null>;
  /** Opens the AI activation (trial access) flow; shown only when access is missing or invalid. */
  onActivate?: () => void;
  onLocalPlan?: () => void;
  onLocalReview?: () => void;
  locale?: 'zh' | 'en';
  unavailableReason?: string;
  onApply: (candidate: CoachApplication) => Promise<unknown>;
  onResponse?: (candidate: CoachApplication) => void;
};

export function CoachPanel(props: CoachPanelProps) {
  const enabled = useFeature('aiAssistantV2'),
    access = useAccessStatus(props.open),
    locale = props.locale ?? props.request?.locale ?? 'zh';
  const invalid = access.status && (access.status.qualification !== 'active' || !access.status.sessionValid),
    disabled = access.status?.aiEnabled === false;
  const canActivate = enabled && invalid && !props.unavailableReason && !!props.onActivate;
  const reason =
    props.unavailableReason ??
    (invalid
      ? canActivate
        ? aiActivationCopy[locale].chatNote
        : accessCopy[locale].reasons.invalid
      : !enabled || disabled
        ? accessCopy[locale].reasons.disabled
        : undefined);
  return (
    <AssistantPanel
      {...props}
      onActivate={canActivate ? props.onActivate : undefined}
      unavailableReason={reason}
      localOnly={props.localOnly || !enabled || !!invalid || disabled}
    />
  );
}
