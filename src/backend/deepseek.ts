import { z } from 'zod';
import { buildAiPrompt } from './prompt';
import { exercises } from '../catalog/exercises';
import { ControlError } from './store';
import type { ProviderCodec } from './supplier-transport';

export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const envelope = z.object({ choices: z.array(z.object({ finish_reason: z.literal('stop'),
  message: z.object({ role: z.literal('assistant'), content: z.string().min(1), tool_calls: z.array(z.unknown()).max(0).optional() }),
})).length(1) });

/** Explicit server adapter; no default activation, retries, SDK telemetry or credentials. */
export function createDeepSeekCodec(options: { maxOutputTokens: number }): ProviderCodec {
  if (!Number.isSafeInteger(options.maxOutputTokens) || options.maxOutputTokens < 1 || options.maxOutputTokens > 8192)
    throw new ControlError('INVALID_SUPPLIER_CONFIG', 500);
  return {
    providerId: 'deepseek',
    async encode(request) {
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
      try {
        const result: unknown = JSON.parse(parsed.data.choices[0].message.content);
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
        // Token counts alone are not a reconciled provider bill in RMB-fen.
        return { result };
      } catch { throw new ControlError('INVALID_CANDIDATE', 502); }
    },
  };
}
