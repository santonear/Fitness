export type CoachLanguageViolation = 'judgment' | 'command' | 'minimizing' | 'exaggeration' | 'exclamation' | 'emoji';

// UIUX20261008, part 2 section 7.2. Apply to generated coach prose, never user notes.
const rules: readonly [CoachLanguageViolation, RegExp][] = [
  ['judgment', /失败|没坚持住|偷懒/],
  ['command', /你应该|你必须/],
  ['minimizing', /只完成了?\s*\d+\s*[/／]\s*\d+/],
  ['exaggeration', /太棒了|你是最棒的/],
  ['exclamation', /[!！]/],
  ['emoji', /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u],
];

/** Returns categories only, so callers need not retain health-related prose in diagnostics. */
export function checkCoachLanguage(text: string): CoachLanguageViolation[] {
  return rules.filter(([, pattern]) => pattern.test(text)).map(([rule]) => rule);
}
