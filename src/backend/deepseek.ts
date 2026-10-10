import { coachV8ProviderPrompt } from './coach-v8-provider';
import { validateTransportRequest } from './contracts';
import { z } from 'zod';
import { buildAiPrompt } from './prompt';
import { exercises } from '../catalog/exercises';
import { ControlError } from './store';
import type { ProviderCodec } from './supplier-transport';
import { validateRequest } from './contracts';
import { guidedProviderPrompt, guidedServiceLimits } from './guided-provider';

export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const envelope = z.object({ choices: z.array(z.object({ finish_reason: z.literal('stop'),
  message: z.object({ role: z.literal('assistant'), content: z.string().min(1), tool_calls: z.array(z.unknown()).max(0).optional() }),
})).length(1) });

/** Explicit server adapter; no default activation, retries, SDK telemetry or credentials. */
export function createDeepSeekCodec(options: { maxOutputTokens: number; pricingVerifiedUntil?: string }): ProviderCodec {
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
      if('coach' in request){await validateTransportRequest(request,14,65536);return {model:'deepseek-flash',messages:coachV8ProviderPrompt(request.coach),thinking:{type:'disabled'},max_tokens:options.maxOutputTokens,response_format:{type:'json_object'},stream:false};}
      if ('dialogue' in request && request.dialogue) {
        await validateRequest(request, guidedServiceLimits.maxDays, guidedServiceLimits.maxInputBytes);
        return { model: 'deepseek-flash', messages: guidedProviderPrompt(request.dialogue), thinking: { type: 'disabled' },
          max_tokens: options.maxOutputTokens, response_format: { type: 'json_object' }, stream: false };
      }
      const prompt = await buildAiPrompt(request);
      if (request.operation === 'generate') {
        const example = { days: [{ date: request.dates[0], exercises: [{
          exerciseId: exercises.find(item => item.metricType === 'reps')!.id,
          order: 0, targetSets: [{ metricType: 'reps', reps: 8 }],
        }] }] };
        prompt.messages[0].content += ` targetSets must always be an array, even for a single set; never a metric object. Represent every planned set as a separate array item, not only as a set count in notes. Shape example only, not a prescribed training plan: ${JSON.stringify(example)}. Choose appropriate exercises and targets from the actual confirmed conditions.`;
      }
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
