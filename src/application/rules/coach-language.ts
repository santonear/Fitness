export type CoachLanguageViolation = 'judgment' | 'command' | 'minimizing' | 'exaggeration' | 'exclamation' | 'emoji';

// UIUX20261008, part 2 section 7.2. Apply to generated coach prose, never user notes.
const rules: readonly [CoachLanguageViolation, RegExp][] = [
  ['judgment', /失败|没坚持住|偷懒/],
  ['command', /你应该|你必须/],
  ['minimizing', /只完成了?\s*\d+\s*[/／]\s*\d+/],
  ['exaggeration', /太棒了|你是最棒的/],
  ['exclamation', /[!！]/],
];

/** Wording v5 (V9.14): at most one emoji per message, only from this fixed list. */
const COACH_EMOJI = ['🎯', '📈', '⚡', '📊', '🧠', '🌱', '😌', '💌', '☕', '💪', '🏔', '🔥'] as const;
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/gu;

function emojiViolation(text: string, context?: 'safety'): boolean {
  if (/\p{Regional_Indicator}|⃣/u.test(text)) return true;
  const found = text.replace(/️/g, '').match(emojiPattern) ?? [];
  if (!found.length) return false;
  if (context === 'safety' || found.length > 1) return true;
  return !(COACH_EMOJI as readonly string[]).includes(found[0] ?? '');
}

function check(text: string, context?: 'safety'): CoachLanguageViolation[] {
  const found = rules.filter(([, pattern]) => pattern.test(text)).map(([rule]) => rule);
  return emojiViolation(text, context) ? [...found, 'emoji'] : found;
}

/** Returns categories only, so callers need not retain health-related prose in diagnostics. */
export function checkCoachLanguage(text: string): CoachLanguageViolation[] {
  return check(text);
}

/** Safety, pain, medical and low-mood lines: same rules, and no emoji at all. */
export function checkSafetyLanguage(text: string): CoachLanguageViolation[] {
  return check(text, 'safety');
}
