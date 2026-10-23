import onboardingZh from '../i18n/features/onboarding/zh.json';
import onboardingEn from '../i18n/features/onboarding/en.json';
import { entryCopy } from '../i18n/features/onboarding/entry';

/**
 * Answers the user tapped (goal, place) are stored as the option's words in the language used at the time.
 * They are preset choices, not the user's own writing, so they are shown in the current language.
 * Stored data is never rewritten; anything that is not an exact preset stays exactly as typed.
 */
const pairs: readonly (readonly [string, string])[] = [
  ...onboardingZh.answers.flatMap((list, group) =>
    list.map((zh, index) => [zh, onboardingEn.answers[group][index]] as const),
  ),
  ...entryCopy.zh.place.options.map((zh, index) => [zh, entryCopy.en.place.options[index]] as const),
];

/** The same preset in the requested language, or undefined when the text is not a preset. */
export function presetIn(text: string, locale: 'zh' | 'en'): string | undefined {
  const value = text.trim();
  const pair = pairs.find(([zh, en]) => zh === value || en === value);
  return pair ? pair[locale === 'zh' ? 0 : 1] : undefined;
}

/** Display text for a stored onboarding answer: tapped presets follow the language, typed text is kept verbatim. */
export function answerText(text: string, locale: 'zh' | 'en'): string {
  return presetIn(text, locale) ?? text;
}

/** Fixed summaries the app wrote into stored plan versions, shown in the current language. */
const summaries: Record<string, readonly [string, string]> = {
  部分时长按动作估算: ['部分时长按动作估算', 'Some durations are estimated from the exercises'],
  改为每周预算: ['改为每周预算', 'Switched to a weekly budget'],
  改为按天安排: ['改为按天安排', 'Switched to day-by-day'],
};
export function storedSummaryText(text: string, locale: 'zh' | 'en'): string {
  const pair = summaries[text.trim()] ?? Object.values(summaries).find(([, en]) => en === text.trim());
  return pair ? pair[locale === 'zh' ? 0 : 1] : text;
}
