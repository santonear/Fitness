import { describe, expect, it } from 'vitest';
import { assistantRequestSchema, sanitizeAssistantRequest, applyAssistantPreferences, type AssistantRequest } from '../../src/assistant/contracts';
import { runAssistantModel, createAssistantProvider, type AssistantProvider } from '../../src/backend/assistant/model';
import { assistantPrompt } from '../../src/backend/assistant/prompts';
import { repairAssistantAttachment } from '../../src/backend/assistant/repair';
import { EXERCISE_IDS, exercises } from '../../src/catalog/exercises';
import { coachV8Exercises, adaptCoachResponse } from '../../src/coach/response-adapter';

const id = '11111111-1111-4111-8111-111111111111';
const request: AssistantRequest = { version: 'fitness-assistant-v2', requestId: id, conversationId: id, locale: 'zh', timeZone: 'Asia/Shanghai', adultConfirmed: true, messages: [{ role: 'user', content: 'Hello' }] };
const context = { version: 'fitness-coach-v8' as const, requestId: id, conversationId: id, restoreGeneration: 0, inputSnapshot: 'PRIVATE_SNAPSHOT', sendConfirmation: 'PRIVATE_CONFIRMATION', locale: 'zh' as const, timeZone: 'Asia/Shanghai', adultConfirmed: true as const, messages: [], task: 'ADJUST_TODAY' as const, target: { planId: id, versionId: id, revision: 0 }, instruction: 'shorter', template: { id: 'A', name: 'A', estimatedMinutes: 20, items: [{ exerciseId: EXERCISE_IDS.bodyweightSquat, equipment: 'none', sets: 2, target: { metricType: 'reps' as const, reps: 8 } }] } };
const attachment = { type: 'today_adjustment', requestId: id, restoreGeneration: 0, mutationAllowed: false, target: context.target, template: context.template, summary: 'A shorter session.' };
const usage = { inputTokens: 10, outputTokens: 3 };
function provider(outputs: unknown[] = [{ attachment: null }]): AssistantProvider {
  return { async *streamText() { yield { delta: 'Hello ' }; yield { delta: 'there<<ATTACHMENT:today>>', usage }; }, async generateAttachment() { const content = outputs.shift(); if (content instanceof Error) throw content; return { content, usage }; } };
}
async function gather<T>(source: AsyncIterable<T>): Promise<T[]> { const result: T[] = []; for await (const value of source) result.push(value); return result; }
async function collect(input = request, model = provider()) { return gather(runAssistantModel(input, { provider: model })); }
describe('assistant v2 model', () => {
  it('streams text before optional attachment and accounts calls', async () => {
    const events = await collect({ ...request, context }, provider([{ attachment }]));
    expect(events.map(e => e.type)).toEqual(['text_delta', 'attachment_pending', 'attachment', 'done']);
    expect(events.at(-1)).toMatchObject({ success: true, usage: { inputTokens: 20, outputTokens: 6 }, calls: [{ stage: 'text' }, { stage: 'attachment' }] });
  });
  it('retains text, retries once, does not consume successful daily message on attachment failure', async () => {
    const events = await collect(request, provider(['bad json', 'still bad']));
    expect(events[0]).toMatchObject({ delta: 'Hello there' });
    expect(events.at(-2)?.type).toBe('attachment_failed');
    expect(events.at(-1)).toMatchObject({ success: false, result: 'attachment_failed', calls: [{ result: 'success' }, { result: 'failed' }, { result: 'failed' }] });
  });
  it('retries invalid attachment successfully', async () => {
    const events = await collect({ ...request, context }, provider(['bad', { attachment }]));
    expect(events.at(-1)).toMatchObject({ success: true, result: 'repaired' });
    expect(events.at(-1)).toMatchObject({calls:[{result:'success'},{result:'failed'},{stage:'attachment',result:'repaired'}]});
  });
  it('marks a mechanically repaired first attachment call in usage records',async () => {
    const candidate=structuredClone(attachment);candidate.template.items[0].sets=200;
    const events=await collect({...request,context},provider([{attachment:candidate}]));
    expect(events.at(-1)).toMatchObject({success:true,result:'repaired',calls:[{result:'success'},{stage:'attachment',result:'repaired'}]});
  });
  it('repairs known exercise names and numeric bounds without changing target identities', () => {
    const candidate = structuredClone(attachment);
    const catalog = coachV8Exercises(context);
    const unique = catalog.find(e => e.metricType === 'reps' && catalog.filter(other => Object.values(other.name).some(n => n.toLowerCase() === e.name.en.toLowerCase())).length === 1)!;
    (candidate.template.items[0] as { exerciseId: string }).exerciseId = unique.name.en;
    candidate.template.items[0].sets = 200;
    const result = repairAssistantAttachment(candidate, { ...request, context });
    expect(result.repaired).toBe(true);
    expect(result.attachment).toMatchObject({ template: { items: [{ exerciseId: unique.id, sets: 10 }] } });
    expect(() => repairAssistantAttachment({ ...attachment, requestId: '22222222-2222-4222-8222-222222222222' }, { ...request, context })).toThrow();
    expect(() => repairAssistantAttachment({ ...attachment, mutationAllowed: true }, { ...request, context })).toThrow();
  });
  it.each(['我今年17岁，给我计划', 'I am 16 years old, make a plan'])('blocks minor attachments despite checked adult flag: %s', async content => {
    const events = await collect({ ...request, context, messages: [{ role: 'user', content }] });
    expect(events.some(e => e.type === 'attachment_pending')).toBe(false);
  });
  it('strips withheld data and never prompts local opaque snapshots', () => {
    const clean = sanitizeAssistantRequest({ ...request, context: { ...context, body: { age: 30 }, history: 'PRIVATE_HISTORY', nutrition: [] } });
    expect(clean.locale).toBe('en'); expect(clean.context?.body).toBeUndefined(); expect(clean.context?.history).toBeUndefined();
    const prompt = JSON.stringify(assistantPrompt(clean, 'text'));
    expect(prompt).not.toContain('PRIVATE_');
    expect(sanitizeAssistantRequest({ ...request, context: { ...context, body: { age: 30 } }, consent: { body: true, history: false } }).context?.body).toEqual({ age: 30 });
  });
  it('sends only bounded current-workout facts independently of optional history consent', () => {
    const currentWorkout={completedSets:[{itemIndex:0,setIndex:0,exerciseId:EXERCISE_IDS.bodyweightSquat,reps:8}],remainingSets:1};
    const input={...request,context:{...context,workoutId:id,history:'PRIVATE_HISTORY'},consent:{body:false,history:false},currentWorkout};
    const clean=sanitizeAssistantRequest(input);
    expect(clean.currentWorkout).toEqual(currentWorkout); expect(clean.context?.history).toBeUndefined();
    const payload=JSON.parse(assistantPrompt(clean,'text').at(-1)!.content);
    expect(payload.currentWorkout).toEqual(currentWorkout); expect(JSON.stringify(payload)).not.toContain('PRIVATE_');
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,notes:'not permitted'}}).success).toBe(false);
    expect(assistantRequestSchema.safeParse({...input,context}).success).toBe(false);
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,completedSets:[...currentWorkout.completedSets,...currentWorkout.completedSets]}}).success).toBe(false);
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,completedSets:[{...currentWorkout.completedSets[0],itemIndex:3}]}}).success).toBe(false);
    // A completed fact can record an actual substitution for the planned exercise.
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,completedSets:[{itemIndex:0,setIndex:0,exerciseId:EXERCISE_IDS.walking,durationSeconds:60}]}}).success).toBe(true);
    expect(repairAssistantAttachment({...attachment,workoutId:id},clean).attachment?.type).toBe('today_adjustment');
    const altered=structuredClone(attachment);altered.template.items[0].sets=3;
    expect(()=>repairAssistantAttachment({...altered,workoutId:id},clean)).toThrow('COMPLETED_ITEM_CHANGED');
  });
  it('limits context and enforces user last message', () => {
    expect(assistantRequestSchema.safeParse({ ...request, messages: Array(21).fill(request.messages[0]) }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ ...request, messages: [{ role: 'assistant', content: 'x' }] }).success).toBe(false);
  });
  it.each(['改为每周两次，每次20分钟，不要沿用30分钟', 'Change to twice a week, 20 minutes, not 30 minutes'])('latest explicit schedule overrides defaults while legacy adapter remains strict: %s', content => {
    const original = {...context,task:'ONBOARD_PLAN' as const,profile:{goalText:'fitness',weeklyTarget:3,sessionMinutes:30,scheduleOriginalText:'old',place:'home' as const,equipment:[],adultConfirmed:true as const,cautions:[]}};
    const {target: _target, template: _template, instruction: _instruction, ...onboard} = original;
    const effective = applyAssistantPreferences(onboard,[{role:'user',content}]);
    expect(effective).toMatchObject({profile:{weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:content,cautions:[]}});
    const candidate = {requestId:id,restoreGeneration:0,mutationAllowed:false,type:'plan_proposal',proposal:{goalText:'fitness',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:content,templates:[context.template,{...context.template,id:'B'}],reasons:['a','b','c']}};
    expect(() => adaptCoachResponse(onboard,candidate)).toThrow();
    expect(repairAssistantAttachment(candidate,{...request,context:effective}).attachment?.type).toBe('plan_proposal');
  });
  it('text generation failure stops second stage', async () => {
    const model = provider(); model.streamText = async function* () { throw new Error('private provider error'); };
    const events = await collect(request, model);
    expect(events.map(e => e.type)).toEqual(['error', 'done']); expect(JSON.stringify(events)).not.toContain('private provider');
    expect(events.at(-1)).toMatchObject({ calls: [{ stage: 'text', result: 'failed' }] });
    const done = events.at(-1); if (done?.type === 'done') expect(done.calls?.[0].inputTokens).toBeUndefined();
  });
  it.each(['<<ATTACHMENT:none>>', '', '<<ATTACHMENT:invalid>>', '<<ATTACHMENT:'])('chat or absent routing marker makes only one model call: %s', async marker => {
    const model = provider();
    model.streamText = async function* () { for (const delta of (`A helpful reply.${marker}`)) yield { delta }; };
    model.generateAttachment = async () => { throw new Error('must not be called'); };
    const events = await collect(request, model);
    expect(events.map(e => e.type)).toEqual(['text_delta','done']);
    expect(events[0]).toMatchObject({delta:'A helpful reply.'});
    expect(events.at(-1)).toMatchObject({ success:true, calls:[{stage:'text'}] });
  });
  it('blocks banned language split across chunks before it is displayed', async () => {
    const model = provider(); model.streamText = async function* () { yield {delta:'你必'}; yield {delta:'须继续'}; };
    const events = await collect(request, model);
    expect(events.some(e => e.type === 'text_delta')).toBe(false);
    expect(events.at(-1)).toMatchObject({success:false});
  });
  it('parses split unicode SSE and rejects truncated streams', async () => {
    const encoded = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\ndata: [DONE]\n\n');
    const mockFetch: typeof fetch = async () => new Response(new ReadableStream({ start(c) { for (const byte of encoded) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
    const model = createAssistantProvider({ apiKey: 'secret', baseUrl: 'https://example.test', fetch: mockFetch });
    const chunks = await gather(model.streamText([])); expect(chunks).toContainEqual({ delta: '你好' }); expect(chunks).toContainEqual({ usage: { inputTokens: 2, outputTokens: 1 } });
    const truncated = createAssistantProvider({ apiKey: '', baseUrl: 'https://example.test', fetch: async () => new Response('data: {"choices":[]}\n') });
    await expect(gather(truncated.streamText([]))).rejects.toThrow('INVALID_STREAM');
  });
  it('does not invent zero usage for incomplete provider reports',async () => {
    const model=createAssistantProvider({apiKey:'',baseUrl:'https://example.test',fetch:async (_url,init)=>{
      const request=JSON.parse(String(init?.body));
      return request.stream ? new Response('data: {"usage":{"prompt_tokens":5}}\n\ndata: [DONE]\n\n') : Response.json({choices:[{message:{content:'{"attachment":null}'}}],usage:{prompt_tokens:5}});
    }});
    expect((await gather(model.streamText([])))[0].usage).toBeUndefined();
    expect((await model.generateAttachment([])).usage).toBeUndefined();
  });
  it.each([401,429,503])('reports HTTP %s safely without leaking provider body or mislabeling network',async status => {
    const model=createAssistantProvider({apiKey:'private-key',baseUrl:'https://example.test',fetch:async()=>new Response('private-provider-body',{status})});
    const events=await collect(request,model);
    expect(events[0]).toEqual({type:'error',code:'MODEL_UNAVAILABLE'});
    expect(events.at(-1)).toMatchObject({calls:[{stage:'text',result:'failed',failureCode:status>=500?'HTTP_5XX':`HTTP_${status}`}]});
    expect(JSON.stringify(events)).not.toContain('private');
  });
  it('distinguishes network failure from malformed output',async () => {
    const network=createAssistantProvider({apiKey:'',baseUrl:'https://example.test',fetch:async()=>{throw new TypeError('private host');}});
    expect((await collect(request,network))[0]).toEqual({type:'error',code:'NETWORK_ERROR'});
    const invalid=createAssistantProvider({apiKey:'',baseUrl:'https://example.test',fetch:async()=>new Response('data: not-json\n\n')});
    expect((await collect(request,invalid)).at(-1)).toMatchObject({calls:[{failureCode:'INVALID_STREAM'}]});
  });
  it.each([
    {prose:'Hello! 👋<<ATTACHMENT:none>>',success:true,code:undefined,result:'repaired'},
    {prose:'你必须继续。<<ATTACHMENT:none>>',success:false,code:'COACH_LANGUAGE',result:'failed'},
    {prose:'<<ATTACHMENT:none>>',success:false,code:'EMPTY_TEXT',result:'failed'},
    {prose:'a'.repeat(16001),success:false,code:'TEXT_LIMIT',result:'failed'},
  ])('real provider adapter drains terminal usage for $code $result',async ({prose,success,code,result}) => {
    let fetches=0;
    const sse=[{choices:[{delta:{content:prose}}]},{choices:[],usage:{prompt_tokens:91,completion_tokens:12}}].map(value=>`data: ${JSON.stringify(value)}\n\n`).join('')+'data: [DONE]\n\n';
    const model=createAssistantProvider({apiKey:'offline-key',baseUrl:'https://example.test',fetch:async()=>{fetches++;return new Response(sse);}});
    const events=await collect(request,model);
    expect(fetches).toBe(1);
    expect(events.at(-1)).toMatchObject({success,result,usage:{inputTokens:91,outputTokens:12},calls:[{inputTokens:91,outputTokens:12,...(code?{failureCode:code}:{result:'repaired'})}]});
    const output=events.filter(e=>e.type==='text_delta').map(e=>e.delta).join('');
    expect(output).toBe(success?'Hello.':'');
  });
  it('identifies prompt preflight errors before calling provider',async () => {
    let fetches=0;const model=createAssistantProvider({apiKey:'',baseUrl:'https://example.test',fetch:async()=>{fetches++;return new Response();}});
    const events=await gather(runAssistantModel(request,{provider:model,promptVersion:'unknown'}));
    expect(fetches).toBe(0);expect(events.at(-1)).toMatchObject({calls:[{failureCode:'INVALID_PROMPT_VERSION'}]});
  });
});




