import type { RefObject } from 'react';
import { MorphPanel } from './common';
import { TrialAccess } from './TrialAccess';
import { ACCESS_CHANGED } from '../useAccessStatus';
import { aiActivationCopy } from '../../i18n/features/coach/activation';

/** Turning on AI 助手芽芽 in place (invitation or trial request), without leaving the page or the chat. */
export function AiActivationSheet({
  open,
  onClose,
  triggerRef,
  locale,
  onSkip,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  locale: 'zh' | 'en';
  onSkip?: () => void;
  onApplied?: () => void;
}) {
  return (
    <MorphPanel
      open={open}
      onClose={onClose}
      triggerRef={triggerRef}
      title={aiActivationCopy[locale].title}
      closeLabel={locale === 'zh' ? '关闭' : 'Close'}
      placement="bottom"
    >
      {open && (
        <TrialAccess
          embedded
          onContinue={() => {
            window.dispatchEvent(new Event(ACCESS_CHANGED));
            onClose();
          }}
          onSkip={onSkip}
          onApplied={onApplied}
        />
      )}
    </MorphPanel>
  );
}
