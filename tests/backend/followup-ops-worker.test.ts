import { expect, it, vi } from 'vitest';
import { createFitnessWorker, type FitnessWorkerEnv } from '../../src/backend/fitness-worker';
import { coachV8ProviderPrompt } from '../../src/backend/coach-v8-provider';
import { coachRequestSchema } from '../../src/coach/contracts';
const control = {fetch: vi.fn(async () => new Response('control'))};
const worker = createFitnessWorker(control);
const env = (value: Partial<FitnessWorkerEnv>) => value as FitnessWorkerEnv;
const post = (path: string, data: unknown) => new Request('https://fitness.example'+path,{method:'POST',headers:{origin:'https://fitness.example','Content-Type':'application/json'},body:JSON.stringify(data)});
it('serves remote flags without model/control configuration and fails closed on KV errors', async () => {
  const request = new Request('https://fitness.example/api/v1/features');
  const response = await worker.fetch(request,env({FITNESS_FEATURE_CONFIG:{get:async () => '{"errorReports":true}'}}));
  expect((await response.json()).flags.errorReports).toBe(true);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const failed = await worker.fetch(request,env({FITNESS_FEATURE_FLAGS:'{"errorReports":true}',FITNESS_FEATURE_CONFIG:{get:async () => {throw new Error('offline');}}}));
  expect((await failed.json()).flags.errorReports).toBe(false);
});
it('collects only gated sanitized events, never raw text or opted-out counts', async () => {
  const send = vi.fn(async () => undefined);
  const config = env({FITNESS_FEATURE_FLAGS:'{"errorReports":true,"anonymousUsage":true}',FITNESS_TELEMETRY:{send}});
  expect((await worker.fetch(post('/api/v1/telemetry/errors',{type:'network',page:'plan',version:'v8',browser:'safari',message:'private'}),config)).status).toBe(400);
  expect((await worker.fetch(post('/api/v1/telemetry/counts',{event:'workout_started',optedIn:false}),config)).status).toBe(400);
  expect(send).not.toHaveBeenCalled();
  expect((await worker.fetch(post('/api/v1/telemetry/counts',{event:'workout_started',optedIn:true}),config)).status).toBe(204);
  expect(send).toHaveBeenCalledWith({event:'workout_started',count:1});
  await worker.fetch(post('/api/v1/telemetry/counts',{event:'workout_started',optedIn:true}),env({FITNESS_TELEMETRY:{send}}));
  expect(send).toHaveBeenCalledTimes(1);
});
it('selects current and frozen previous prompts without changing user payload', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const request = coachRequestSchema.parse({ version:'fitness-coach-v8', requestId:id, conversationId:id,restoreGeneration:0,inputSnapshot:'scope',sendConfirmation:'confirmed',locale:'en',timeZone:'UTC',adultConfirmed:true,messages:[],task:'ONBOARD_PLAN',profile:{goalText:'habit',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'20 minutes',place:'home',equipment:[],adultConfirmed:true,cautions:[]} });
  const current = coachV8ProviderPrompt(request), previous = coachV8ProviderPrompt(request,'v8.0.0');
  expect(current[0].content).toContain('@v8.1.0');
  expect(previous[0].content).toContain('@v8.0.0');
  expect(current[1]).toEqual(previous[1]);
});
