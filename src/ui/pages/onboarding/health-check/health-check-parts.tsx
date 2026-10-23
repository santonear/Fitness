import { Rules } from '../../../../engine/data';
import { BigChoice } from '../../../components/kit';
import type { OnboardingAnswers } from '../OnboardingPage';
import { type MissingKey } from '../../../../i18n/features/onboarding/plan-mode';

export const rules = new Rules();
export const cmrKeys = rules.get('safety.screen.cmr_symptoms').symptoms as string[];
export const age45 = rules.get('safety.age45.vigorous_advisory').age_min_years as number;
export const parts = ['knee', 'back', 'shoulder', 'wrist', 'other'] as const;
export type Group = 'parq' | 'cmr' | 'other' | 'preg' | 'falls' | 'redflag';
export interface Item {
  key: string;
  text: string;
  value: boolean | undefined;
  set: (answer: boolean) => void;
}
export interface Screen {
  id: string;
  group?: Group;
  item?: Item;
  index?: number;
  total?: number;
}

export interface HealthCheckWizardProps {
  locale: 'zh' | 'en';
  answers: OnboardingAnswers;
  engineEnabled: boolean;
  bodyEnabled: boolean;
  mode: 'ai' | 'basic';
  busy: boolean;
  error?: string;
  step: number;
  total: number;
  complete: boolean;
  sendFields: [string, string | number][];
  onChange: (answers: OnboardingAnswers) => void;
  onExit: () => void;
  onGenerate: () => void;
  onManual: () => void;
  /** 回到今天 (after confirming, unsaved answers are cleared). */
  onHome?: () => void;
  /** Starting screen id (tests and resuming); defaults to the first screen. */
  initialScreen?: string;
  /** AI planning exists in this deployment: 芽芽 asks AI-or-local before the ready screen. */
  aiAvailable?: boolean;
  /** Earlier onboarding answers still missing, with the outer step that fixes each. */
  missingOuter?: { key: MissingKey; step: number }[];
  onOuterStep?: (step: number) => void;
}

/** Big 是/否 pair; the parent advances after an answer. */
export function YesNo({
  value,
  onAnswer,
  yes,
  no,
  disabled,
}: {
  value: boolean | undefined;
  onAnswer: (answer: boolean) => void;
  yes: string;
  no: string;
  disabled?: boolean;
}) {
  return (
    <div className="v9-yesno" role="radiogroup">
      <BigChoice label={yes} selected={value === true} disabled={disabled} onClick={() => onAnswer(true)} />
      <BigChoice label={no} selected={value === false} disabled={disabled} onClick={() => onAnswer(false)} />
    </div>
  );
}
