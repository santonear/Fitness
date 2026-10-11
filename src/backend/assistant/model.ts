import { sanitizeAssistantRequest, type AssistantCall, type AssistantEvent, type AssistantUsage } from '../../assistant/contracts';
import { assistantPrompt, ASSISTANT_PROMPT_VERSION, type AssistantPromptMessage } from './prompts';
import { repairAssistantAttachment } from './repair';

export interface AssistantProvider {
  streamText(messages: AssistantPromptMessage[], signal?: AbortSignal): AsyncIterable<{ delta?: string; usage?: AssistantUsage }>;
  generateAttachment(messages: AssistantPromptMessage[], signal?: AbortSignal): Promise<{ content: unknown; usage: AssistantUsage }>;
}
export type AssistantModelOptions = { provider: AssistantProvider; promptVersion?: string; signal?: AbortSignal };

/** No persistence. Admission, charging and local confirmation belong to callers. */
export async function* runAssistantModel(input: unknown, options: AssistantModelOptions): AsyncGenerator<AssistantEvent> {
  const request = sanitizeAssistantRequest(input);
  // Account confirmation never overrides a disclosed minor age in the conversation.
  const minor = request.messages.filter(m => m.role === 'user').some(m => /(?:我(?:今年)?\s*(?:[1-9]|1[0-7])\s*岁|\bI(?:'m| am)\s+(?:[1-9]|1[0-7])\s*(?:years? old)?\b)/i.test(m.content));
  if (minor) request.adultConfirmed = false;
  const version = options.promptVersion ?? ASSISTANT_PROMPT_VERSION;
  const calls: AssistantCall[] = [];
  const usage = () => calls.reduce((sum, call) => ({ inputTokens: sum.inputTokens + call.inputTokens, outputTokens: sum.outputTokens + call.outputTokens }), { inputTokens: 0, outputTokens: 0 });
  let text = '';
  const textCall: AssistantCall = { stage: 'text', result: 'failed', inputTokens: 0, outputTokens: 0 };
  calls.push(textCall);
  try {
    for await (const chunk of options.provider.streamText(assistantPrompt(request, 'text', version), options.signal)) {
      if (options.signal?.aborted) throw new Error('ABORTED');
      if (chunk.usage) Object.assign(textCall, chunk.usage);
      if (chunk.delta) {
        if (text.length + chunk.delta.length > 16000) throw new Error('TEXT_LIMIT');
        text += chunk.delta;
        yield { type: 'text_delta', delta: chunk.delta };
      }
    }
    if (!text.trim()) throw new Error('EMPTY_TEXT');
    textCall.result = 'success';
  } catch {
    yield { type: 'error', code: options.signal?.aborted ? 'ABORTED' : 'GENERATION_FAILED' };
    yield { type: 'done', success: false, usage: usage(), calls, promptVersion: version, result: 'failed' };
    return;
  }
  if (!request.adultConfirmed) {
    yield { type: 'done', success: true, usage: usage(), calls, promptVersion: version, result: 'success' };
    return;
  }
  yield { type: 'attachment_pending' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const call: AssistantCall = { stage: 'attachment', result: 'failed', inputTokens: 0, outputTokens: 0 };
    calls.push(call);
    try {
      if (options.signal?.aborted) throw new Error('ABORTED');
      const generated = await options.provider.generateAttachment(assistantPrompt(request, 'attachment', version, text, attempt ? 'ATTACHMENT_VALIDATION_FAILED: use exact schema, catalog, context identity and task' : undefined), options.signal);
      Object.assign(call, generated.usage);
      const checked = repairAssistantAttachment(generated.content, request);
      call.result = 'success';
      if (checked.attachment) yield { type: 'attachment', attachment: checked.attachment };
      yield { type: 'done', success: true, usage: usage(), calls, promptVersion: version, result: checked.repaired || attempt ? 'repaired' : 'success' };
      return;
    } catch {
      if (options.signal?.aborted) break;
    }
  }
  yield { type: 'attachment_failed', code: 'ATTACHMENT_UNAVAILABLE' };
  yield { type: 'done', success: false, usage: usage(), calls, promptVersion: version, result: 'attachment_failed' };
}

/** OpenAI-compatible provider. Credential never appears in prompts, events or logs. */
export function createAssistantProvider(options: { apiKey: string; baseUrl: string; model?: string; maxTokens?: number; fetch?: typeof fetch }): AssistantProvider {
  const send = async (messages: AssistantPromptMessage[], stream: boolean, signal?: AbortSignal) => {
    const response = await (options.fetch ?? fetch)(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal, headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model ?? 'deepseek-flash', messages, stream, max_tokens: Math.max(1, Math.min(options.maxTokens ?? (stream ? 1600 : 3000), 3000)), ...(stream ? { stream_options: { include_usage: true } } : { response_format: { type: 'json_object' } }) }),
    });
    if (!response.ok) throw new Error('PROVIDER_FAILED');
    return response;
  };
  const usage = (raw?: { prompt_tokens?: number; completion_tokens?: number }): AssistantUsage => ({ inputTokens: Math.max(0, raw?.prompt_tokens ?? 0), outputTokens: Math.max(0, raw?.completion_tokens ?? 0) });
  return {
    async *streamText(messages, signal) {
      const response = await send(messages, true, signal);
      if (!response.body) throw new Error('EMPTY_STREAM');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', complete = false;
      try {
        while (!complete) {
          const part = await reader.read();
          buffer += decoder.decode(part.value, { stream: !part.done });
          if (buffer.length > 65536) throw new Error('STREAM_FRAME_LIMIT');
          const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
          if (part.done && buffer) { lines.push(buffer); buffer = ''; }
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { complete = true; break; }
            if (!data) continue;
            const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
            yield { ...(parsed.choices?.[0]?.delta?.content ? { delta: parsed.choices[0].delta.content } : {}), ...(parsed.usage ? { usage: usage(parsed.usage) } : {}) };
          }
          if (part.done) { if (!complete) throw new Error('TRUNCATED_STREAM'); break; }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    },
    async generateAttachment(messages, signal) {
      const response = await send(messages, false, signal);
      const body = await response.text();
      if (body.length > 65536) throw new Error('ATTACHMENT_LIMIT');
      const parsed = JSON.parse(body) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return { content: parsed.choices?.[0]?.message?.content, usage: usage(parsed.usage) };
    },
  };
}
