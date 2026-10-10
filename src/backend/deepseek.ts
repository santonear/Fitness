import { coachV8ProviderPrompt } from './coach-v8-provider';
import type { CoachPromptRelease } from './coach-v8-version';
import { validateTransportRequest } from './contracts';
import { z } from 'zod';
import { buildStageSummaryPrompt } from './summary-provider';
import { ControlError } from './store';
import type { ProviderCodec } from './supplier-transport';
import { assertCurrentAiExecution } from './retired-ai';

export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const envelope = z.object({ choices: z.array(z.object({ finish_reason: z.literal('stop'),
  message: z.object({ role: z.literal('assistant'), content: z.string().min(1), tool_calls: z.array(z.unknown()).max(0).optional() }),
})).length(1) });

/** Explicit server adapter; no default activation, retries, SDK telemetry or credentials. */
export function createDeepSeekCodec(options: { maxOutputTokens: number; pricingVerifiedUntil?: string; coachPromptRelease?: CoachPromptRelease }): ProviderCodec {
  if (!Number.isSafeInteger(options.maxOutputTokens) || options.maxOutputTokens < 1 || options.maxOutputTokens > 8192)
    throw new ControlError('INVALID_SUPPLIER_CONFIG', 500);
  return {
    providerId: 'deepseek',
    costUpperBoundFen() {
      const until = Date.parse(options.pricingVerifiedUntil ?? '');
      // Official 2026-10-07 price ceiling: uncached input CNY 2/M, output CNY 8/M.
      // Use the full 1M context as input (round up to 2^20), not a token estimate.
      if (!Number.isFinite(until) || until <= Date.now()) return undefined;
      return Math.ceil((1_048_576 * 200 + options.maxOutputTokens * 800) / 1_000_000);
    },
    async encode(request) {
      if('coach' in request){await validateTransportRequest(request,14,65536);return {model:'deepseek-flash',messages:coachV8ProviderPrompt(request.coach,options.coachPromptRelease),thinking:{type:'disabled'},max_tokens:options.maxOutputTokens,response_format:{type:'json_object'},stream:false};}
      assertCurrentAiExecution(request);
      const prompt = await buildStageSummaryPrompt(request);
      return { model: 'deepseek-flash', messages: prompt.messages, thinking: { type: 'disabled' },
        max_tokens: options.maxOutputTokens, response_format: { type: 'json_object' }, stream: false };
    },
    decode(body) {
      const parsed = envelope.safeParse(body);
      if (!parsed.success) throw new ControlError('INVALID_CANDIDATE', 502);
      if (options.pricingVerifiedUntil) {
        const usage = z.object({ model: z.enum(['deepseek-flash', 'deepseek-v4.1-flash']), usage: z.object({
          prompt_tokens: z.number().int().nonnegative().max(1_048_576),
          completion_tokens: z.number().int().nonnegative().max(options.maxOutputTokens),
          total_tokens: z.number().int().nonnegative(),
        }) }).safeParse(body);
        if (!usage.success || usage.data.usage.total_tokens !== usage.data.usage.prompt_tokens + usage.data.usage.completion_tokens)
          throw new ControlError('COST_BOUND_UNVERIFIED', 503);
      }
      try {
        const result: unknown = JSON.parse(parsed.data.choices[0].message.content);
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
        // Token counts alone are not a reconciled provider bill in RMB-fen.
        return { result };
      } catch { throw new ControlError('INVALID_CANDIDATE', 502); }
    },
  };
}
