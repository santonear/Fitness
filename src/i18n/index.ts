import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';

export type Language = 'en' | 'zh';
export const languageKey = 'fitness.language';
function savedLanguage(): Language {
  try { return localStorage.getItem(languageKey) === 'zh' ? 'zh' : 'en'; }
  catch { return 'en'; }
}
void i18n.use(initReactI18next).init({ resources: { en: { translation: en }, zh: { translation: zh } }, lng: savedLanguage(), fallbackLng: 'en', supportedLngs: ['en', 'zh'], interpolation: { escapeValue: false }, initAsync: false });
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (language) => {
  const supported = language === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = supported;
  try { localStorage.setItem(languageKey, supported); } catch { /* Current language remains usable when storage is unavailable. */ }
});
export default i18n;
