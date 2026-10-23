import type { AssistantUsage } from '../../../assistant/contracts';
import { assistantPrompt, type AssistantPromptMessage } from '../prompts';
import { AttachmentValidationError } from '../repair';
import { ZodError } from 'zod';

export interface AssistantProvider {
  streamText(
    messages: AssistantPromptMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<{ delta?: string; usage?: AssistantUsage }>;
  generateAttachment(
    messages: AssistantPromptMessage[],
    signal?: AbortSignal,
  ): Promise<{ content: unknown; usage?: AssistantUsage }>;
}
export type AssistantModelOptions = { provider: AssistantProvider; promptVersion?: string; signal?: AbortSignal };
export type AssistantProviderFailureCode =
  | 'HTTP_400'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_404'
  | 'HTTP_408'
  | 'HTTP_422'
  | 'HTTP_429'
  | 'HTTP_5XX'
  | 'HTTP_OTHER'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_STREAM'
  | 'INVALID_OUTPUT'
  | 'ABORTED'
  | 'VALIDATION_FAILED'
  | 'COACH_LANGUAGE'
  | 'EMPTY_TEXT'
  | 'TEXT_LIMIT'
  | 'PROMPT_BUILD_FAILED'
  | 'INVALID_PROMPT_VERSION'
  | AttachmentValidationError['code'];
export class AssistantProviderError extends Error {
  constructor(public readonly code: AssistantProviderFailureCode) {
    super(code);
  }
}
export function failureCode(error: unknown, signal?: AbortSignal): AssistantProviderFailureCode {
  if (signal?.aborted)
    return signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError' ? 'TIMEOUT' : 'ABORTED';
  return error instanceof AssistantProviderError || error instanceof AttachmentValidationError
    ? error.code
    : 'VALIDATION_FAILED';
}
export function publicFailure(code: AssistantProviderFailureCode) {
  return code === 'NETWORK_ERROR'
    ? 'NETWORK_ERROR'
    : code === 'TIMEOUT'
      ? 'TIMEOUT'
      : code === 'ABORTED'
        ? 'ABORTED'
        : 'MODEL_UNAVAILABLE';
}
export function failureDetail(error: unknown): string | undefined {
  if (error instanceof ZodError)
    return error.issues
      .slice(0, 5)
      .map(issue => `${issue.path.map(String).join('.') || 'root'}:${issue.code}`)
      .join(';')
      .slice(0, 300);
  if (error instanceof AttachmentValidationError) {
    const paths = [
      ...error.feedback.matchAll(
        /([A-Za-z0-9_.?]+):\s*(invalid_type|too_small|too_big|invalid_value|invalid_union|unrecognized_keys)/g,
      ),
    ]
      .slice(0, 5)
      .map(match => `${match[1]}:${match[2]}`);
    return paths.join(';') || `attachment:${error.code}`;
  }
  if (error instanceof Error && ['NO_APPLICABLE_CHANGE', 'NO_SAFE_PLAN'].includes(error.message))
    return `attachment:${error.message}`;
  return undefined;
}
export function buildPrompt(...args: Parameters<typeof assistantPrompt>) {
  try {
    return assistantPrompt(...args);
  } catch (error) {
    throw new AssistantProviderError(
      error instanceof Error && error.message === 'INVALID_PROMPT_VERSION'
        ? 'INVALID_PROMPT_VERSION'
        : 'PROMPT_BUILD_FAILED',
    );
  }
}
export function localEnglishReply(message: string) {
  if (/pain|hurt|discomfort|chest/i.test(message))
    return 'Stop the movement that hurts. If the pain is severe or persists, seek professional care.';
  if (/secret|system prompt|ignore|bypass|overwrite/i.test(message))
    return 'I cannot bypass confirmation or reveal private instructions. I can help you review a safe plan.';
  if (/history|height|weight|body data/i.test(message))
    return 'We can discuss training without those details. What would you like to focus on?';
  if (/plan|workout|training|exercise/i.test(message)) return 'I can prepare a training suggestion for you to review.';
  return 'I can help with your training question. Tell me what you would like to focus on.';
}
export function estimatedUsage(messages: AssistantPromptMessage[], output: string): AssistantUsage {
  // A disclosed estimate when the supplier omits usage, never an asserted bill.
  return {
    inputTokens: Math.ceil(new TextEncoder().encode(JSON.stringify(messages)).byteLength / 2),
    outputTokens: Math.ceil(new TextEncoder().encode(output).byteLength / 2),
    usageEstimated: true,
  };
}
