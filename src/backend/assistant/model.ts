import { sanitizeAssistantRequest, type AssistantCall, type AssistantEvent, type AssistantUsage } from '../../assistant/contracts';
import { assistantPrompt, ASSISTANT_PROMPT_VERSION, type AssistantPromptMessage } from './prompts';
import { repairAssistantAttachment } from './repair';
import { checkCoachLanguage } from '../../application/rules/coach-language';

export interface AssistantProvider {
  streamText(messages: AssistantPromptMessage[], signal?: AbortSignal): AsyncIterable<{ delta?: string; usage?: AssistantUsage }>;
  generateAttachment(messages: AssistantPromptMessage[], signal?: AbortSignal): Promise<{ content: unknown; usage?: AssistantUsage }>;
}
export type AssistantModelOptions = { provider: AssistantProvider; promptVersion?: string; signal?: AbortSignal };
export type AssistantProviderFailureCode = 'HTTP_400' | 'HTTP_401' | 'HTTP_403' | 'HTTP_404' | 'HTTP_408' | 'HTTP_422' | 'HTTP_429' | 'HTTP_5XX' | 'HTTP_OTHER' | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_STREAM' | 'INVALID_OUTPUT' | 'ABORTED' | 'VALIDATION_FAILED';
export class AssistantProviderError extends Error {
  constructor(public readonly code: AssistantProviderFailureCode) { super(code); }
}
function failureCode(error: unknown, signal?: AbortSignal): AssistantProviderFailureCode {
  if (signal?.aborted) return signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError' ? 'TIMEOUT' : 'ABORTED';
  return error instanceof AssistantProviderError ? error.code : 'VALIDATION_FAILED';
}
function publicFailure(code: AssistantProviderFailureCode) { return code === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : code === 'TIMEOUT' ? 'TIMEOUT' : code === 'ABORTED' ? 'ABORTED' : 'MODEL_UNAVAILABLE'; }

/** No persistence. Admission, charging and local confirmation belong to callers. */
export async function* runAssistantModel(input: unknown, options: AssistantModelOptions): AsyncGenerator<AssistantEvent> {
  const request = sanitizeAssistantRequest(input);
  // Account confirmation never overrides a disclosed minor age in the conversation.
  const minor = request.messages.filter(m => m.role === 'user').some(m => /(?:我(?:今年)?\s*(?:[1-9]|1[0-7])\s*岁|\bI(?:'m| am)\s+(?:[1-9]|1[0-7])\s*(?:years? old)?\b)/i.test(m.content));
  if (minor) request.adultConfirmed = false;
  const version = options.promptVersion ?? ASSISTANT_PROMPT_VERSION;
  const calls: AssistantCall[] = [];
  const usage = () => calls.reduce((sum, call) => ({ inputTokens: sum.inputTokens + (call.inputTokens ?? 0), outputTokens: sum.outputTokens + (call.outputTokens ?? 0) }), { inputTokens: 0, outputTokens: 0 });
  let text = '', emitted = 0, attachmentKind = 'none';
  const textCall: AssistantCall = { stage: 'text', result: 'failed' };
  calls.push(textCall);
  try {
    for await (const chunk of options.provider.streamText(assistantPrompt(request, 'text', version), options.signal)) {
      if (options.signal?.aborted) throw new Error('ABORTED');
      if (chunk.usage) Object.assign(textCall, chunk.usage);
      if (chunk.delta) {
        if (text.length + chunk.delta.length > 16000) throw new Error('TEXT_LIMIT');
        text += chunk.delta;
        if (checkCoachLanguage(text).length) throw new Error('COACH_LANGUAGE');
        // Hold the short routing suffix and any partial banned phrase across chunks.
        const markerAt = text.indexOf('<<ATTACHMENT:');
        const safeEnd = Math.max(emitted, Math.min(text.length - 80, markerAt < 0 ? text.length : markerAt));
        if (safeEnd > emitted) { yield { type: 'text_delta', delta: text.slice(emitted, safeEnd) }; emitted = safeEnd; }
      }
    }
    const marker = text.match(/<<ATTACHMENT:(none|plan|today|change|exercise|review)>>\s*$/);
    if (marker) { attachmentKind = marker[1]; text = text.slice(0, marker.index).trimEnd(); }
    else if (text.includes('<<ATTACH')) text = text.slice(0, text.indexOf('<<ATTACH')).trimEnd();
    if (!text.trim()) throw new Error('EMPTY_TEXT');
    if (text.length > emitted) yield { type: 'text_delta', delta: text.slice(emitted) };
    textCall.result = 'success';
  } catch (error) {
    textCall.failureCode = failureCode(error, options.signal);
    console.warn('assistant_provider_failure', { stage: 'text', code: textCall.failureCode });
    yield { type: 'error', code: publicFailure(textCall.failureCode as AssistantProviderFailureCode) };
    yield { type: 'done', success: false, usage: usage(), calls, promptVersion: version, result: 'failed' };
    return;
  }
  if (!request.adultConfirmed || attachmentKind === 'none') {
    yield { type: 'done', success: true, usage: usage(), calls, promptVersion: version, result: 'success' };
    return;
  }
  yield { type: 'attachment_pending' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const call: AssistantCall = { stage: 'attachment', result: 'failed' };
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
    } catch (error) {
      call.failureCode = failureCode(error, options.signal);
      console.warn('assistant_provider_failure', { stage: 'attachment', code: call.failureCode });
      if (options.signal?.aborted) break;
      if (error instanceof AssistantProviderError && !['INVALID_OUTPUT', 'INVALID_STREAM'].includes(error.code)) break;
    }
  }
  yield { type: 'attachment_failed', code: 'ATTACHMENT_UNAVAILABLE' };
  yield { type: 'done', success: false, usage: usage(), calls, promptVersion: version, result: 'attachment_failed' };
}

/** OpenAI-compatible provider. Credential never appears in prompts, events or logs. */
export function createAssistantProvider(options: { apiKey: string; baseUrl: string; model?: string; maxTokens?: number; maxInputBytes?: number; fetch?: typeof fetch }): AssistantProvider {
  const send = async (messages: AssistantPromptMessage[], stream: boolean, signal?: AbortSignal) => {
    if(new TextEncoder().encode(JSON.stringify(messages)).byteLength > (options.maxInputBytes ?? 131072)) throw new AssistantProviderError('INVALID_OUTPUT');
    let response: Response;
    try { response = await (options.fetch ?? fetch)(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal, headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model ?? 'deepseek-flash', messages, stream, thinking: { type: 'disabled' }, max_tokens: Math.max(1, Math.min(options.maxTokens ?? (stream ? 1600 : 3000), 3000)), ...(stream ? { stream_options: { include_usage: true } } : { response_format: { type: 'json_object' } }) }),
    }); } catch { throw new AssistantProviderError(signal?.aborted ? signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError' ? 'TIMEOUT' : 'ABORTED' : 'NETWORK_ERROR'); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const known = [400,401,403,404,408,422,429].includes(response.status);
      throw new AssistantProviderError(response.status >= 500 ? 'HTTP_5XX' : known ? `HTTP_${response.status}` as AssistantProviderFailureCode : 'HTTP_OTHER');
    }
    return response;
  };
  const usage = (raw?: { prompt_tokens?: number; completion_tokens?: number }): AssistantUsage | undefined =>
    raw && Number.isSafeInteger(raw.prompt_tokens) && Number.isSafeInteger(raw.completion_tokens) && raw.prompt_tokens! >= 0 && raw.completion_tokens! >= 0
      ? { inputTokens: raw.prompt_tokens!, outputTokens: raw.completion_tokens! } : undefined;
  return {
    async *streamText(messages, signal) {
      const response = await send(messages, true, signal);
      if (!response.body) throw new AssistantProviderError('INVALID_STREAM');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', complete = false;
      try {
        while (!complete) {
          const part = await reader.read();
          buffer += decoder.decode(part.value, { stream: !part.done });
          if (buffer.length > 65536) throw new AssistantProviderError('INVALID_STREAM');
          const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
          if (part.done && buffer) { lines.push(buffer); buffer = ''; }
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { complete = true; break; }
            if (!data) continue;
            let parsed: { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
            try { parsed = JSON.parse(data); } catch { throw new AssistantProviderError('INVALID_STREAM'); }
            yield { ...(parsed.choices?.[0]?.delta?.content ? { delta: parsed.choices[0].delta.content } : {}), ...(parsed.usage ? { usage: usage(parsed.usage) } : {}) };
          }
          if (part.done) { if (!complete) throw new AssistantProviderError('INVALID_STREAM'); break; }
        }
      } catch(error) { if(error instanceof AssistantProviderError) throw error; throw new AssistantProviderError(signal?.aborted ? 'TIMEOUT' : error instanceof TypeError ? 'NETWORK_ERROR' : 'INVALID_STREAM'); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    },
    async generateAttachment(messages, signal) {
      const response = await send(messages, false, signal);
      const reader=response.body?.getReader(); if(!reader) throw new AssistantProviderError('INVALID_OUTPUT');
      const decoder=new TextDecoder();let body='',bytes=0;
      try { while(true) {const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65536)throw new AssistantProviderError('INVALID_OUTPUT');body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode(); }
      catch(error) {if(error instanceof AssistantProviderError)throw error;throw new AssistantProviderError(signal?.aborted?'TIMEOUT':'NETWORK_ERROR');}
      finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
      let parsed: { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      try {parsed=JSON.parse(body);} catch {throw new AssistantProviderError('INVALID_OUTPUT');}
      return { content: parsed.choices?.[0]?.message?.content, ...(parsed.usage ? { usage: usage(parsed.usage) } : {}) };
    },
  };
}
