import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';

export type Language = 'en' | 'zh';
export const languageKey = 'fitness.language';
function savedLanguage(): Language {
  try {
    return localStorage.getItem(languageKey) === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh'],
  interpolation: { escapeValue: false },
  initAsync: false,
});
/** Service workers read the language here to word notifications (public/pwa/sw-template.js, public/admin-sw.js). */
function shareWithServiceWorker(language: Language) {
  const unavailable = () => {
    /* Notifications fall back to Chinese when the cache is unavailable. */
  };
  try {
    if (typeof caches === 'undefined') return;
    caches
      .open('fitness-settings')
      .then(cache => cache.put('/__fitness-language', new Response(language)))
      .catch(unavailable);
  } catch {
    unavailable();
  }
}
document.documentElement.lang = i18n.language;
shareWithServiceWorker(i18n.language === 'zh' ? 'zh' : 'en');
i18n.on('languageChanged', language => {
  const supported = language === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = supported;
  shareWithServiceWorker(supported);
  try {
    localStorage.setItem(languageKey, supported);
  } catch {
    /* Current language remains usable when storage is unavailable. */
  }
});
export default i18n;
