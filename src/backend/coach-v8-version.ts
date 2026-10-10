/** Version metadata is independent of server-owned prompt text. */
export const COACH_V8_PROMPT_VERSION = 'v8.1.0' as const;
export const COACH_V8_PREVIOUS_PROMPT_VERSION = 'v8.0.0' as const;
export type CoachPromptRelease = typeof COACH_V8_PROMPT_VERSION | typeof COACH_V8_PREVIOUS_PROMPT_VERSION;
