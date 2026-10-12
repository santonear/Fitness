import { describe, expect, it } from 'vitest';
import { assistantRequestSchema, sanitizeAssistantRequest, applyAssistantPreferences, type AssistantRequest } from '../../src/assistant/contracts';
import { runAssistantModel, createAssistantProvider, type AssistantProvider } from '../../src/backend/assistant/model';
import { assistantPrompt } from '../../src/backend/assistant/prompts';
import { repairAssistantAttachment,assistantExercises } from '../../src/backend/assistant/repair';
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
async function collect(input = request, model = provider()) { return gather(runAssistantModel(input, { provider: model, promptVersion:'assistant-v2.1.0' })); }
describe('assistant v2 model', () => {
  it('assembles a V3 adjustment from minimal intent without model-supplied identity',async()=>{
    const model=provider([{kind:'today_adjust',minutes:10}]);
    model.streamText=async function*(){yield {delta:'今天整理成短版。<<ATTACHMENT:today>>',usage};};
    const events=await gather(runAssistantModel({...request,context},{provider:model,promptVersion:'assistant-v3.0.0'}));
    expect(events.some(event=>event.type==='attachment'&&event.attachment.type==='today_adjustment'&&event.attachment.requestId===id)).toBe(true);
    expect(events.at(-1)).toMatchObject({success:true,promptVersion:'assistant-v3.0.0'});
  });
  it('keeps V3 exercise guidance in text without trying to create a nonexistent card',async()=>{
    let calls=0;const model=provider();model.generateAttachment=async()=>{calls++;throw Error('should not call');};
    model.streamText=async function*(){yield {delta:'先保持动作稳定。<<ATTACHMENT:exercise>>',usage};};
    const events=await gather(runAssistantModel(request,{provider:model,promptVersion:'assistant-v3.0.0'}));
    expect(calls).toBe(0);expect(events.at(-1)).toMatchObject({success:true});
  });
  it('builds an exercise guide card locally without a second model call',async()=>{
    let calls=0;const model=provider();model.generateAttachment=async()=>{calls++;throw Error('should not call');};
    model.streamText=async function*(){yield {delta:'可以先看动作要点。<<ATTACHMENT:exercise>>',usage};};
    const events=await gather(runAssistantModel({...request,messages:[{role:'user',content:'介绍一下徒手深蹲的动作'}]},{provider:model,promptVersion:'assistant-v3.0.0'}));
    expect(calls).toBe(0);
    expect(events.some(event=>event.type==='attachment'&&event.attachment.type==='exercise_info'&&event.attachment.exerciseId===EXERCISE_IDS.bodyweightSquat)).toBe(true);
  });
  it('keeps free chat usable when the model requests an inapplicable plan card',async()=>{
    const model=provider();model.generateAttachment=async()=>{throw Error('should not call');};
    model.streamText=async function*(){yield {delta:'I can discuss training with you.<<ATTACHMENT:plan>>',usage};};
    const events=await gather(runAssistantModel(request,{provider:model,promptVersion:'assistant-v3.0.0'}));
    expect(events.at(-1)).toMatchObject({type:'done',success:true});
    expect(events.some(event=>event.type==='attachment_failed')).toBe(false);
  });
  it('creates a draft when an explicit weekday schedule gets a missing marker',async()=>{
    const {target:_target,template:_template,instruction:_instruction,...common}=context;
    const input={...request,messages:[{role:'user' as const,content:'Monday Wednesday Friday evenings; maybe weekends, 40 minutes each'}],context:{...common,task:'ONBOARD_PLAN' as const,profile:{goalText:'fitness',weeklyTarget:3,sessionMinutes:40,scheduleOriginalText:'Monday Wednesday Friday evenings',place:'home' as const,equipment:['none'],adultConfirmed:true as const,cautions:[]}}};
    const model=provider([{kind:'plan_new',params:{daysPerWeek:3}}]);
    model.streamText=async function*(){yield {delta:'Three weekdays can be your baseline.<<ATTACHMENT:none>>',usage};};
    const events=await gather(runAssistantModel(input,{provider:model,promptVersion:'assistant-v3.0.0'}));
    expect(events.some(event=>event.type==='attachment'&&event.attachment.type==='plan_proposal'&&event.attachment.proposal.weeklyTarget===3)).toBe(true);
  });
  it('replaces a wrong-language English response before emitting it',async()=>{
    const model=provider();model.generateAttachment=async()=>{throw Error('should not call');};
    model.streamText=async function*(){yield {delta:'可以，聊训练没问题。你更想先聊哪一类？<<ATTACHMENT:none>>',usage};};
    const events=await gather(runAssistantModel({...request,messages:[{role:'user',content:'Can we discuss training without history?'}]},{provider:model,promptVersion:'assistant-v3.0.0'}));
    const text=events.filter(event=>event.type==='text_delta').map(event=>event.delta).join('');
    expect(text).toContain('We can discuss training');
    expect(text).not.toMatch(/[\u3400-\u9fff]/u);
    expect(events.at(-1)).toMatchObject({type:'done',success:true,result:'repaired'});
  });
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
  it('does not report success when promised attachment is replaced with null',async () => {
    const events=await collect({...request,context},provider(['invalid',{attachment:null}]));
    expect(events.at(-1)).toMatchObject({success:false,result:'attachment_failed'});
  });
  it('normalizes a generic plan marker to the actual local adjustment contract',async () => {
    const model=provider([{attachment}]);model.streamText=async function*(){yield {delta:'A shorter session.<<ATTACHMENT:plan>>',usage};};
    const events=await collect({...request,context},model);
    expect(events.some(event=>event.type==='attachment' && event.attachment.type==='today_adjustment')).toBe(true);
    expect(events.at(-1)).toMatchObject({success:true});
  });
  it('passes bounded field diagnostics without invalid values into the one attachment retry',async () => {
    const prompts:string[]=[];const model=provider();let call=0;
    model.generateAttachment=async messages=>{prompts.push(JSON.stringify(messages));return {content:call++?{attachment}:{...attachment,template:{...attachment.template,items:[{...attachment.template.items[0],sets:'PRIVATE_INVALID_VALUE'}]}},usage};};
    const events=await collect({...request,context},model);
    expect(events.at(-1)).toMatchObject({success:true,result:'repaired'});
    expect(prompts[1]).toContain('template.items.0.sets');
    expect(prompts[1]).toContain('expected number');
    expect(prompts[1]).not.toContain('PRIVATE_INVALID_VALUE');
  });
  it.each(['Gym, twice weekly, 20 minutes each. Help me plan','健身房，每周两次，每次20分钟，帮我安排'])('latest place overrides prior home snapshot without inventing equipment: %s',content=>{
    const {target:_target,template:_template,instruction:_instruction,...common}=context;
    const input={...request,messages:[{role:'user' as const,content}],context:{...common,task:'ONBOARD_PLAN' as const,profile:{goalText:'fitness',weeklyTarget:3,sessionMinutes:40,scheduleOriginalText:'old',place:'home' as const,equipment:['At home without equipment'],adultConfirmed:true as const,cautions:['knee' as const]}}};
    const clean=sanitizeAssistantRequest(input);
    expect(clean.context).toMatchObject({profile:{place:'gym',equipment:[],weeklyTarget:2,cautions:['knee']}});
    expect(assistantExercises(clean).length).toBeGreaterThan(0);
    expect(assistantExercises(clean).every(exercise=>exercise.equipment==='none')).toBe(true);
    expect(clean.context).toMatchObject({profile:{equipment:[]}});
    expect(assistantPrompt(clean,'text').at(-1)).toEqual({role:'user',content});
    const withDumbbells=sanitizeAssistantRequest({...input,messages:[{role:'user',content:'在家，只有哑铃'}]});
    expect(withDumbbells.context).toMatchObject({profile:{place:'home',equipment:['dumbbell'],cautions:['knee']}});
  });
  it('supports once weekly and attempts a ten-minute adjustment',async () => {
    const {target:_target,template:_template,instruction:_instruction,...common}=context;
    const contextPlan={...common,task:'ONBOARD_PLAN' as const,profile:{goalText:'fitness',weeklyTarget:3,sessionMinutes:40,scheduleOriginalText:'old',place:'gym' as const,equipment:[],adultConfirmed:true as const,cautions:[]}};
    expect(applyAssistantPreferences(contextPlan,[{role:'user',content:'once weekly'}])).toMatchObject({profile:{weeklyTarget:1}});
    const model=provider();let attachments=0;model.generateAttachment=async()=>{attachments++;return {content:{attachment:null},usage};};
    const events=await collect({...request,context,messages:[{role:'user',content:'Only 10 minutes today'}]},model);
    expect(attachments).toBe(2);expect(events.some(event=>event.type==='attachment_pending')).toBe(true);
    expect(events.at(-1)).toMatchObject({success:false,result:'attachment_failed'});
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
    const payload=JSON.parse(assistantPrompt(clean,'text')[1].content);
    expect(payload.currentWorkout).toEqual(currentWorkout); expect(JSON.stringify(payload)).not.toContain('PRIVATE_');
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,notes:'not permitted'}}).success).toBe(false);
    expect(assistantRequestSchema.safeParse({...input,context}).success).toBe(false);
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,completedSets:[...currentWorkout.completedSets,...currentWorkout.completedSets]}}).success).toBe(false);
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,completedSets:[{...currentWorkout.completedSets[0],itemIndex:3}]}}).success).toBe(false);
    // A completed fact can record an actual substitution for the planned exercise.
    expect(assistantRequestSchema.safeParse({...input,currentWorkout:{...currentWorkout,completedSets:[{itemIndex:0,setIndex:0,exerciseId:EXERCISE_IDS.walking,durationSeconds:60}]}}).success).toBe(true);
    expect(repairAssistantAttachment({...attachment,workoutId:id},clean).attachment?.type).toBe('today_adjustment');
    const altered=structuredClone(attachment);altered.template.items[0].sets=3;
    expect(()=>repairAssistantAttachment({...altered,workoutId:id},clean)).toThrow('ATTACHMENT_CONDITIONS');
  });
  it('limits context and enforces user last message', () => {
    expect(assistantRequestSchema.safeParse({ ...request, messages: Array(21).fill(request.messages[0]) }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ ...request, messages: [{ role: 'assistant', content: 'x' }] }).success).toBe(false);
  });
  it.each(['改为每周两次，每次20分钟，不要沿用30分钟', 'Change to twice a week, 20 minutes, not 30 minutes'])('latest explicit schedule overrides defaults while legacy adapter remains strict: %s', content => {
    const original = {...context,task:'ONBOARD_PLAN' as const,profile:{goalText:'fitness',weeklyTarget:3,sessionMinutes:30,scheduleOriginalText:'old',place:'home' as const,equipment:[],adultConfirmed:true as const,cautions:[]}};
    const {target: _target, template: _template, instruction: _instruction, ...onboard} = original;
    const effective = applyAssistantPreferences(onboard,[{role:'user',content}]);
    expect(effective).toMatchObject({profile:{weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'old',cautions:[]}});
    const candidate = {requestId:id,restoreGeneration:0,mutationAllowed:false,type:'plan_proposal',proposal:{goalText:'fitness',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'old',templates:[context.template,{...context.template,id:'B'}],reasons:['a','b','c']}};
    expect(adaptCoachResponse(onboard,candidate).type).toBe('plan_proposal');
    expect(repairAssistantAttachment(candidate,{...request,context:effective}).attachment?.type).toBe('plan_proposal');
  });
  it('text generation failure stops second stage', async () => {
    const model = provider(); model.streamText = async function* () { throw new Error('private provider error'); };
    const events = await collect(request, model);
    expect(events.map(e => e.type)).toEqual(['error', 'done']); expect(JSON.stringify(events)).not.toContain('private provider');
    expect(events.at(-1)).toMatchObject({ calls: [{ stage: 'text', result: 'failed' }] });
    const done = events.at(-1); if (done?.type === 'done') { expect(done.calls?.[0].inputTokens).toBeGreaterThan(0); expect(done.usage.usageEstimated).toBe(true); }
  });
  it('estimates missing usage for text and a successful attachment without claiming exact supplier tokens',async()=>{
    const model=provider([{kind:'today_adjust',minutes:15}]);
    model.streamText=async function*(){yield {delta:'我先整理一下。<<ATTACHMENT:today>>'};};
    model.generateAttachment=async()=>({content:{kind:'today_adjust',minutes:15}});
    const events=await gather(runAssistantModel({...request,context},{provider:model,promptVersion:'assistant-v3.1.0'}));
    const done=events.at(-1);if(done?.type!=='done')throw Error('missing done');
    expect(done.success).toBe(true);
    expect(done.usage).toMatchObject({usageEstimated:true});
    expect(done.calls).toHaveLength(2);
    expect(done.calls?.every(call=>call.usageEstimated&&Number.isInteger(call.inputTokens)&&Number.isInteger(call.outputTokens))).toBe(true);
  });
  it('includes estimated usage in a failed attachment completion',async()=>{
    const model=provider();
    model.streamText=async function*(){yield {delta:'我先整理一下。<<ATTACHMENT:today>>'};};
    model.generateAttachment=async()=>{throw Error('provider omitted output')};
    const events=await gather(runAssistantModel({...request,context},{provider:model,promptVersion:'assistant-v2.1.0'}));
    const done=events.at(-1);if(done?.type!=='done')throw Error('missing done');
    expect(done.success).toBe(false);
    expect(done.usage.usageEstimated).toBe(true);
    expect(done.calls?.every(call=>Number.isInteger(call.inputTokens)&&Number.isInteger(call.outputTokens))).toBe(true);
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
  it.each([{attachment:undefined,expected:1200},{attachment:3000,expected:3000},{attachment:9000,expected:3000}])('uses separate attachment output bound $attachment while retaining legacy shared limit',async ({attachment,expected}) => {
    const outbound:{stream:boolean;max_tokens:number}[]=[];
    const provider=createAssistantProvider({apiKey:'',baseUrl:'https://example.test',maxTokens:1200,maxAttachmentTokens:attachment,fetch:async(_url,init)=>{
      const body=JSON.parse(String(init?.body));outbound.push(body);
      return body.stream?new Response('data: [DONE]\n\n'):Response.json({choices:[{message:{content:'{"attachment":null}'}}]});
    }});
    await gather(provider.streamText([]));await provider.generateAttachment([]);
    expect(outbound.map(call=>({stream:call.stream,max_tokens:call.max_tokens}))).toEqual([{stream:true,max_tokens:1200},{stream:false,max_tokens:expected}]);
  });
});






