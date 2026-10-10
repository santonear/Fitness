import { expect, it, vi } from 'vitest';
import { createHandler } from '../../src/backend/http';
import type { ControlService } from '../../src/backend/control';
import { createDeepSeekCodec } from '../../src/backend/deepseek';
import { createGeminiCodec } from '../../src/backend/gemini';
import { currentCoachEnvelope } from '../fixtures/current-coach-envelope';
import { promptRequest } from '../fixtures/prompt-cases';
import { validateRequest } from '../../src/backend/contracts';

it('retires old management and date execution before admission, while preserving the V8 endpoint', async () => {
  const submit = vi.fn(async () => ({accepted:true}));
  const handler = createHandler({submit} as unknown as ControlService,{origins:['https://fitness.test'],maxBodyBytes:65536});
  const send = (path:string,body:unknown) => handler(new Request(`https://fitness.test/api/v1/${path}`,{method:'POST',headers:{Origin:'https://fitness.test','Content-Type':'application/json',Cookie:`__Host-fitness_trial=${'a'.repeat(64)}`},body:JSON.stringify(body)}));
  for (const body of [await promptRequest('en','understand'),await promptRequest('en'),{operation:'understand',dialogue:{coachTask:'manage'}}]) {
    const response = await send(body.operation === 'understand' ? 'goals/interpret' : 'plans/generate',body);
    expect(response.status).toBe(410); expect(await response.json()).toEqual({error:'AI_CONTRACT_RETIRED'});
  }
  expect(submit).not.toHaveBeenCalled();
  expect((await send('plans/generate',await currentCoachEnvelope())).status).toBe(200);
  expect(submit).toHaveBeenCalledTimes(1);
});
it('real provider codecs cannot construct retired requests, but old confirmed objects still parse read-only',async () => {
  const old = await promptRequest('en');
  await expect(validateRequest(old,1,65536)).resolves.toEqual(old);
  for (const codec of [createDeepSeekCodec({maxOutputTokens:2048}),createGeminiCodec({maxOutputTokens:2048})]) {
    await expect(codec.encode(old)).rejects.toThrow('AI_CONTRACT_RETIRED');
    await expect(codec.encode(await currentCoachEnvelope())).resolves.toBeDefined();
  }
});
