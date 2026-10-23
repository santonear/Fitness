import type { AssistantUsage } from '../../../assistant/contracts';
import type { AssistantPromptMessage } from '../prompts';
import { AssistantProviderError, type AssistantProvider, type AssistantProviderFailureCode } from './failure';

/** OpenAI-compatible provider. Credential never appears in prompts, events or logs. */
export function createAssistantProvider(options: {
  apiKey: string;
  baseUrl: string;
  model?: string;
  maxTokens?: number;
  maxAttachmentTokens?: number;
  maxInputBytes?: number;
  fetch?: typeof fetch;
}): AssistantProvider {
  const send = async (messages: AssistantPromptMessage[], stream: boolean, signal?: AbortSignal) => {
    if (new TextEncoder().encode(JSON.stringify(messages)).byteLength > (options.maxInputBytes ?? 131072))
      throw new AssistantProviderError('INVALID_OUTPUT');
    let response: Response;
    try {
      response = await (options.fetch ?? fetch)(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model ?? 'deepseek-flash',
          messages,
          stream,
          thinking: { type: 'disabled' },
          max_tokens: Math.max(
            1,
            Math.min(
              (stream ? options.maxTokens : (options.maxAttachmentTokens ?? options.maxTokens)) ??
                (stream ? 1600 : 3000),
              3000,
            ),
          ),
          ...(stream
            ? { stream_options: { include_usage: true } }
            : { temperature: 0.1, response_format: { type: 'json_object' } }),
        }),
      });
    } catch {
      throw new AssistantProviderError(
        signal?.aborted
          ? signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
            ? 'TIMEOUT'
            : 'ABORTED'
          : 'NETWORK_ERROR',
      );
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const known = [400, 401, 403, 404, 408, 422, 429].includes(response.status);
      throw new AssistantProviderError(
        response.status >= 500
          ? 'HTTP_5XX'
          : known
            ? (`HTTP_${response.status}` as AssistantProviderFailureCode)
            : 'HTTP_OTHER',
      );
    }
    return response;
  };
  const usage = (raw?: { prompt_tokens?: number; completion_tokens?: number }): AssistantUsage | undefined =>
    raw &&
    Number.isSafeInteger(raw.prompt_tokens) &&
    Number.isSafeInteger(raw.completion_tokens) &&
    raw.prompt_tokens! >= 0 &&
    raw.completion_tokens! >= 0
      ? { inputTokens: raw.prompt_tokens!, outputTokens: raw.completion_tokens! }
      : undefined;
  return {
    async *streamText(messages, signal) {
      const response = await send(messages, true, signal);
      if (!response.body) throw new AssistantProviderError('INVALID_STREAM');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '',
        complete = false;
      try {
        while (!complete) {
          const part = await reader.read();
          buffer += decoder.decode(part.value, { stream: !part.done });
          if (buffer.length > 65536) throw new AssistantProviderError('INVALID_STREAM');
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          if (part.done && buffer) {
            lines.push(buffer);
            buffer = '';
          }
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              complete = true;
              break;
            }
            if (!data) continue;
            let parsed: {
              choices?: { delta?: { content?: string } }[];
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            try {
              parsed = JSON.parse(data);
            } catch {
              throw new AssistantProviderError('INVALID_STREAM');
            }
            yield {
              ...(parsed.choices?.[0]?.delta?.content ? { delta: parsed.choices[0].delta.content } : {}),
              ...(parsed.usage ? { usage: usage(parsed.usage) } : {}),
            };
          }
          if (part.done) {
            if (!complete) throw new AssistantProviderError('INVALID_STREAM');
            break;
          }
        }
      } catch (error) {
        if (error instanceof AssistantProviderError) throw error;
        throw new AssistantProviderError(
          signal?.aborted ? 'TIMEOUT' : error instanceof TypeError ? 'NETWORK_ERROR' : 'INVALID_STREAM',
        );
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
    async generateAttachment(messages, signal) {
      const response = await send(messages, false, signal);
      const reader = response.body?.getReader();
      if (!reader) throw new AssistantProviderError('INVALID_OUTPUT');
      const decoder = new TextDecoder();
      let body = '',
        bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 65536) throw new AssistantProviderError('INVALID_OUTPUT');
          body += decoder.decode(part.value, { stream: true });
        }
        body += decoder.decode();
      } catch (error) {
        if (error instanceof AssistantProviderError) throw error;
        throw new AssistantProviderError(signal?.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      let parsed: {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new AssistantProviderError('INVALID_OUTPUT');
      }
      return {
        content: parsed.choices?.[0]?.message?.content,
        ...(parsed.usage ? { usage: usage(parsed.usage) } : {}),
      };
    },
  };
}
