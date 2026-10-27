import { PrimaryButton } from './kit';

/** 返回 on a sub-page (Bo 2026-10-27): the page you came from, or `onFallback` when the app was opened right here. */
export function BackButton({ locale, onFallback }: { locale: 'zh' | 'en'; onFallback: () => void }) {
  return (
    <PrimaryButton
      tone="text"
      size="sm"
      // react-router keeps the in-app history position in history.state.idx; 0 means nothing to go back to.
      onClick={() => ((window.history.state?.idx ?? 0) > 0 ? window.history.back() : onFallback())}
    >
      {locale === 'zh' ? '‹ 返回' : '‹ Back'}
    </PrimaryButton>
  );
}
