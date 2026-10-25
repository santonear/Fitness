import { useMainline } from '../mainline/context';
import { themeEntryCopy } from '../../i18n/features/home/theme';
import { LanguageButton, TextSizeButton, ThemeButton } from './ThemeSheet';

/** Language, 大字号 (Bo 2026-10-25) and 换风格 as separate buttons, at the top of 今天, 计划, 回顾 and 我的 (Bo 2026-10-22). */
export function PageSwitches() {
  const { locale, setLanguage, busy } = useMainline();
  return (
    <div className="v9-page-switches" role="group" aria-label={themeEntryCopy[locale].switches}>
      <LanguageButton locale={locale} onChange={setLanguage} busy={busy} />
      <TextSizeButton locale={locale} />
      <ThemeButton locale={locale} />
    </div>
  );
}
