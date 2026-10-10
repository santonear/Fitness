import { currentCoachEnvelope } from '../fixtures/current-coach-envelope';
import { expect, it } from 'vitest';
import { createDeepSeekCodec } from '../../src/backend/deepseek';
import { promptRequest, fourMetricCandidate } from '../fixtures/prompt-cases';
import { validateCandidate } from '../../src/backend/contracts';
const codec = () => createDeepSeekCodec({ maxOutputTokens: 2048 });
const response = (content: string, finish_reason = 'stop') => ({ choices: [{ finish_reason, message: { role: 'assistant', content } }] });
it('encodes only confirmed synthetic inputs with JSON mode, bounded output and disabled thinking', async () => {
  for (const locale of ['en','zh'] as const) {
    const body = await codec().encode(await currentCoachEnvelope(locale)) as any;
    expect(body.model).toBe('deepseek-flash'); expect(body.max_tokens).toBe(2048);
    expect(body.thinking).toEqual({type:'disabled'}); expect(body.response_format).toEqual({type:'json_object'});
    expect(body.stream).toBe(false); expect(body.tools).toBeUndefined();
    expect(JSON.parse(body.messages[1].content).request.locale).toBe(locale);
  }
});
it('decodes valid candidates without treating usage as settled cost', async () => {
  const request = await promptRequest('en'); const candidate = fourMetricCandidate();
  const decoded = codec().decode({...response(JSON.stringify(candidate)),usage:{total_tokens:10}});
  expect(validateCandidate(request,decoded.result)).toEqual(candidate); expect(decoded.actualCost).toBeUndefined();
});
it('rejects truncation, empty/malformed/nonobject responses, multiple choices and tool calls', () => {
  for(const value of [response('{}','length'),response(''),response('oops'),response('[]'),
    {choices:[...response('{}').choices,...response('{}').choices]},
    {choices:[{finish_reason:'stop',message:{role:'assistant',content:'{}',tool_calls:[{}]}}]}])
    expect(()=>codec().decode(value)).toThrow('INVALID_CANDIDATE');
});
it('rejects stale send confirmation before constructing supplier input', async () => {
  const request = await promptRequest('en'); if (request.operation !== 'generate') throw new Error(); request.dates=['2026-10-07'];
  await expect(codec().encode(request)).rejects.toMatchObject({code:'AI_CONTRACT_RETIRED'});
});

it('refuses retired date generation before building a provider payload', async () => {
 await expect(codec().encode(await promptRequest('en'))).rejects.toThrow('AI_CONTRACT_RETIRED');
});

it('requires matching model and complete bounded usage before allowing later pending calls', () => {
  const verified = createDeepSeekCodec({ maxOutputTokens: 2048, pricingVerifiedUntil: '2099-01-01T00:00:00Z' });
  const valid = { ...response('{"interpretedGoal":"Fitness"}'), model: 'deepseek-flash',
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } };
  expect(verified.decode(valid)).toEqual({ result: { interpretedGoal: 'Fitness' } });
  for (const invalid of [
    { ...valid, model: 'deepseek-v4-pro' }, { ...valid, usage: undefined },
    { ...valid, usage: { ...valid.usage, total_tokens: 121 } },
    { ...valid, usage: { prompt_tokens: 1_048_577, completion_tokens: 20, total_tokens: 1_048_597 } },
    { ...valid, usage: { prompt_tokens: 100, completion_tokens: 2049, total_tokens: 2149 } },
  ]) expect(() => verified.decode(invalid)).toThrow('COST_BOUND_UNVERIFIED');
});
