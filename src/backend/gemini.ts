import { coachV8ProviderPrompt } from './coach-v8-provider';
import { assertCurrentAiExecution } from './retired-ai';
import { validateTransportRequest } from './contracts';
import { z } from 'zod';
import { candidateJsonSchema } from './contracts';
import { buildStageSummaryPrompt } from './summary-provider';
import { ControlError } from './store';
import type { ProviderCodec } from './supplier-transport';

export function geminiEndpoint(model: string): string {
  if (!/^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(model)) throw new ControlError('INVALID_SUPPLIER_CONFIG', 500);
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const responseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z.array(z.object({
    finishReason: z.literal('STOP'),
    content: z.object({ parts: z.array(z.strictObject({ text: z.string(), thought: z.boolean().optional(), thoughtSignature: z.string().optional() })).min(1) }),
  })).length(1),
});

/** Adapt output hints only; local validation still enforces the complete contract. */
function geminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(geminiSchema);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    // The nested exercise maxItems hint causes INVALID_ARGUMENT on the verified model.
    // Array limits remain enforced by validateCandidate before any candidate is accepted.
    if (key === 'maxItems' || key === 'pattern' || (key === 'maximum' && item === Number.MAX_SAFE_INTEGER)) continue;
    if (key === 'oneOf') result.anyOf = geminiSchema(item);
    else if (key === 'const') result.enum = [item];
    else if (key === 'exclusiveMinimum' && source.type === 'integer' && typeof item === 'number') result.minimum = item + 1;
    else result[key] = geminiSchema(item);
  }
  return result;
}

/** Explicitly constructed codec only. No default model, credentials, telemetry or network. */
export function createGeminiCodec(options: { maxOutputTokens: number }): ProviderCodec {
  if (!Number.isSafeInteger(options.maxOutputTokens) || options.maxOutputTokens < 1 || options.maxOutputTokens > 8192)
    throw new ControlError('INVALID_SUPPLIER_CONFIG', 500);
  const maxOutputTokens = options.maxOutputTokens;
  return {
    providerId: 'gemini', credentialHeader: 'x-goog-api-key',
    async encode(request) {
      if('coach' in request){await validateTransportRequest(request,14,65536);const messages=coachV8ProviderPrompt(request.coach);return {systemInstruction:{parts:[{text:messages[0].content}]},contents:[{role:'user',parts:[{text:messages[1].content}]}],generationConfig:{candidateCount:1,maxOutputTokens,responseMimeType:'application/json'}};}
      assertCurrentAiExecution(request);
      const prompt = await buildStageSummaryPrompt(request);
      return {
        systemInstruction: { parts: [{ text: prompt.messages[0].content }] },
        contents: [{ role: 'user', parts: [{ text: prompt.messages[1].content }] }],
        generationConfig: { candidateCount: 1, maxOutputTokens, responseMimeType: 'application/json',
          responseJsonSchema: geminiSchema(candidateJsonSchema(request.operation)) },
      };
    },
    decode(body) {
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success || parsed.data.promptFeedback?.blockReason) throw new ControlError('INVALID_CANDIDATE', 502);
      const text = parsed.data.candidates[0].content.parts.filter(part => !part.thought).map(part => part.text).join('');
      try {
        const result: unknown = JSON.parse(text);
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('object required');
        // No actualCost: usage token metadata does not prove free tier or RMB billing.
        return { result };
      } catch { throw new ControlError('INVALID_CANDIDATE', 502); }
    },
  };
}
