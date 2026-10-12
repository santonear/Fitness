import { sanitizeAssistantRequest, type AssistantCall, type AssistantEvent, type AssistantUsage } from '../../assistant/contracts';
import { assistantPrompt, ASSISTANT_PROMPT_VERSION, type AssistantPromptMessage } from './prompts';
import { repairAssistantAttachment, AttachmentValidationError } from './repair';
import { checkCoachLanguage } from '../../application/rules/coach-language';
import { assembleAssistantIntent } from './assemble';
import { selectAssistantCandidates, assistantMovement } from '../../catalog/ai-catalog';
import { getExerciseGuide } from '../../catalog/exercise-guide';
import { exercises } from '../../catalog/exercises';
import { ZodError } from 'zod';

export interface AssistantProvider {
  streamText(messages: AssistantPromptMessage[], signal?: AbortSignal): AsyncIterable<{ delta?: string; usage?: AssistantUsage }>;
  generateAttachment(messages: AssistantPromptMessage[], signal?: AbortSignal): Promise<{ content: unknown; usage?: AssistantUsage }>;
}
export type AssistantModelOptions = { provider: AssistantProvider; promptVersion?: string; signal?: AbortSignal };
export type AssistantProviderFailureCode = 'HTTP_400' | 'HTTP_401' | 'HTTP_403' | 'HTTP_404' | 'HTTP_408' | 'HTTP_422' | 'HTTP_429' | 'HTTP_5XX' | 'HTTP_OTHER' | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_STREAM' | 'INVALID_OUTPUT' | 'ABORTED' | 'VALIDATION_FAILED' | 'COACH_LANGUAGE' | 'EMPTY_TEXT' | 'TEXT_LIMIT' | 'PROMPT_BUILD_FAILED' | 'INVALID_PROMPT_VERSION' | AttachmentValidationError['code'];
export class AssistantProviderError extends Error {
  constructor(public readonly code: AssistantProviderFailureCode) { super(code); }
}
function failureCode(error: unknown, signal?: AbortSignal): AssistantProviderFailureCode {
  if (signal?.aborted) return signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError' ? 'TIMEOUT' : 'ABORTED';
  return error instanceof AssistantProviderError || error instanceof AttachmentValidationError ? error.code : 'VALIDATION_FAILED';
}
function publicFailure(code: AssistantProviderFailureCode) { return code === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : code === 'TIMEOUT' ? 'TIMEOUT' : code === 'ABORTED' ? 'ABORTED' : 'MODEL_UNAVAILABLE'; }
function failureDetail(error:unknown):string|undefined{
 if(error instanceof ZodError)return error.issues.slice(0,5).map(issue=>`${issue.path.map(String).join('.')||'root'}:${issue.code}`).join(';').slice(0,300);
 if(error instanceof AttachmentValidationError){const paths=[...error.feedback.matchAll(/([A-Za-z0-9_.?]+):\s*(invalid_type|too_small|too_big|invalid_value|invalid_union|unrecognized_keys)/g)].slice(0,5).map(match=>`${match[1]}:${match[2]}`);return paths.join(';')||`attachment:${error.code}`;}
 if(error instanceof Error&&['NO_APPLICABLE_CHANGE','NO_SAFE_PLAN'].includes(error.message))return `attachment:${error.message}`;
 return undefined;
}
function buildPrompt(...args: Parameters<typeof assistantPrompt>) {
  try { return assistantPrompt(...args); }
  catch(error) { throw new AssistantProviderError(error instanceof Error && error.message === 'INVALID_PROMPT_VERSION' ? 'INVALID_PROMPT_VERSION' : 'PROMPT_BUILD_FAILED'); }
}
function localEnglishReply(message:string){
 if(/pain|hurt|discomfort|chest/i.test(message))return 'Stop the movement that hurts. If the pain is severe or persists, seek professional care.';
 if(/secret|system prompt|ignore|bypass|overwrite/i.test(message))return 'I cannot bypass confirmation or reveal private instructions. I can help you review a safe plan.';
 if(/history|height|weight|body data/i.test(message))return 'We can discuss training without those details. What would you like to focus on?';
 if(/plan|workout|training|exercise/i.test(message))return 'I can prepare a training suggestion for you to review.';
 return 'I can help with your training question. Tell me what you would like to focus on.';
}
function estimatedUsage(messages:AssistantPromptMessage[],output:string):AssistantUsage{
 // A disclosed estimate when the supplier omits usage, never an asserted bill.
 return {inputTokens:Math.ceil(new TextEncoder().encode(JSON.stringify(messages)).byteLength/2),outputTokens:Math.ceil(new TextEncoder().encode(output).byteLength/2),usageEstimated:true};
}

/** No persistence. Admission, charging and local confirmation belong to callers. */
export async function* runAssistantModel(input: unknown, options: AssistantModelOptions): AsyncGenerator<AssistantEvent> {
  const request = sanitizeAssistantRequest(input);
  // Account confirmation never overrides a disclosed minor age in the conversation.
  const minor = request.messages.filter(m => m.role === 'user').some(m => /(?:我(?:今年)?\s*(?:[1-9]|1[0-7])\s*岁|\bI(?:'m| am)\s+(?:[1-9]|1[0-7])\s*(?:years? old)?\b)/i.test(m.content));
  if (minor) request.adultConfirmed = false;
  const version = options.promptVersion ?? ASSISTANT_PROMPT_VERSION;
  const isV3=version.startsWith('assistant-v3.');
  const calls: AssistantCall[] = [];
  const usage = () => calls.reduce((sum, call) => ({ inputTokens: sum.inputTokens + (call.inputTokens ?? 0), outputTokens: sum.outputTokens + (call.outputTokens ?? 0),usageEstimated:sum.usageEstimated||!!call.usageEstimated }), { inputTokens: 0, outputTokens: 0,usageEstimated:false });
  let text = '', emitted = 0, attachmentKind = 'none', proseNormalized = false, foreignLanguage = false;
  const holdForCard=isV3&&!!request.context&&['ADJUST_TODAY','MODIFY_PLAN'].includes(request.context.task);
  let blockedText: 'COACH_LANGUAGE' | 'TEXT_LIMIT' | undefined;
  const textCall: AssistantCall = { stage: 'text', result: 'failed' };
  calls.push(textCall);
  try {
    const textPrompt=buildPrompt(request, 'text', version);
    for await (const chunk of options.provider.streamText(textPrompt, options.signal)) {
      if (options.signal?.aborted) throw new Error('ABORTED');
      if (chunk.usage) Object.assign(textCall, chunk.usage);
      // Keep draining this already-started bounded request for final token accounting.
      // Blocked prose is never emitted, stored or logged, and no new request is made.
      if (blockedText) continue;
      if (chunk.delta) {
        if (text.length + chunk.delta.length > 16000) { blockedText='TEXT_LIMIT'; continue; }
        text += chunk.delta;
        if(request.locale==='en'&&[...text.matchAll(/[\u3400-\u9fff]/gu)].length>=4)foreignLanguage=true;
        const normalized = text.replace(/[!！]+/g, request.locale === 'zh' ? '。' : '.').replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3|\uFE0F|\u200D/gu, '');
        if(normalized !== text) {text=normalized;proseNormalized=true;}
        if (checkCoachLanguage(text).length) { blockedText='COACH_LANGUAGE'; continue; }
        // Hold the short routing suffix and any partial banned phrase across chunks.
        const markerAt = text.indexOf('<<ATTACHMENT:');
        const safeEnd = Math.max(emitted, Math.min(text.length - 80, markerAt < 0 ? text.length : markerAt));
        if (!foreignLanguage&&!holdForCard&&safeEnd > emitted) { yield { type: 'text_delta', delta: text.slice(emitted, safeEnd) }; emitted = safeEnd; }
      }
    }
    if (blockedText) throw new AssistantProviderError(blockedText);
    const marker = text.match(/<<ATTACHMENT:(none|plan|today|change|exercise|review)>>\s*$/);
    if (marker) {
      attachmentKind = marker[1]; text = text.slice(0, marker.index).trimEnd();
      // The local task defines the applicable card contract; model shorthand cannot change it.
      if(request.context && ['plan','today','change','review'].includes(attachmentKind)) attachmentKind=({ONBOARD_PLAN:'plan',ADJUST_TODAY:'today',MODIFY_PLAN:'change',PERIOD_REVIEW:'review'} as const)[request.context.task];
      if(isV3&&attachmentKind==='exercise'){
        const latest=request.messages.at(-1)?.content??'';
        // A request to replace an exercise needs the proposed replacement card.
        if(/换(?:个|成|掉)?动作|替换|replace|swap|alternative/i.test(latest)&&request.context?.task==='MODIFY_PLAN')attachmentKind='change';
        else if(/换(?:个|成|掉)?动作|替换|replace|swap|alternative/i.test(latest)&&request.context?.task==='ADJUST_TODAY')attachmentKind='today';
      }
    }
    else if (text.includes('<<ATTACH')) text = text.slice(0, text.indexOf('<<ATTACH')).trimEnd();
    if(isV3&&attachmentKind==='none'&&/(?:介绍|讲讲|动作要领|怎么做|explain|how to do)/i.test(request.messages.at(-1)?.content??''))attachmentKind='exercise';
    if(isV3&&attachmentKind==='none'&&request.adultConfirmed&&request.context){
      const latest=request.messages.at(-1)?.content??'';
      const declined=/(?:不要|先别|不用|撤回|只聊|do not|don't|withdraw|just discuss|no plan)/i.test(latest);
      if(!declined&&request.context.task==='ONBOARD_PLAN'&&/(?:帮我安排|给我.*(?:计划|全身训练)|help me plan|full.body workout|make a plan|一三五|周[一二三四五六日].*周[一二三四五六日]|(?:Mon|Monday).*(?:Wed|Wednesday).*(?:Fri|Friday))/i.test(latest))attachmentKind='plan';
      if(!declined&&request.context.task==='ADJUST_TODAY'&&/(?:今天.*(?:缩短|调整|训练)|shorter workout|workout today|adjust today)/i.test(latest))attachmentKind='today';
    }
    if(foreignLanguage){text=localEnglishReply(request.messages.at(-1)?.content??'');emitted=0;proseNormalized=true;}
    if(holdForCard&&/(?:已(?:经)?(?:按|换成|替换成|保存|记住|应用)|我(?:按.+替换|会记住)|一并替换成|(?:I|we)(?:'ve| have)?\s+(?:replaced|saved|remembered|applied))/i.test(text)){
      text=request.locale==='zh'?'我先整理一份可预览的调整。':'I will prepare an adjustment for you to review.';
      proseNormalized=true;
    }
    if (!text.trim()) throw new AssistantProviderError('EMPTY_TEXT');
    if (text.length > emitted) yield { type: 'text_delta', delta: text.slice(emitted) };
    if(textCall.inputTokens===undefined||textCall.outputTokens===undefined)Object.assign(textCall,estimatedUsage(textPrompt,text));
    textCall.result = proseNormalized ? 'repaired' : 'success';
  } catch (error) {
    if(textCall.inputTokens===undefined||textCall.outputTokens===undefined)Object.assign(textCall,estimatedUsage([{role:'user',content:JSON.stringify(request)}],text));
    textCall.failureCode = failureCode(error, options.signal);
    console.warn('assistant_provider_failure', { stage: 'text', code: textCall.failureCode });
    yield { type: 'error', code: publicFailure(textCall.failureCode as AssistantProviderFailureCode) };
    yield { type: 'done', success: false, usage: usage(), calls, promptVersion: version, result: 'failed' };
    return;
  }
  if(isV3&&attachmentKind==='exercise'){
    const latest=request.messages.at(-1)?.content.toLocaleLowerCase()??'';
    const candidate=selectAssistantCandidates(request).find(row=>[row.exercise.name.zh,row.exercise.name.en].some(name=>latest.includes(name.toLocaleLowerCase())));
    if(candidate){const guide=getExerciseGuide(candidate.exercise.id,request.locale);yield {type:'attachment',attachment:{type:'exercise_info',exerciseId:candidate.exercise.id,summary:guide.keyPoints.join(request.locale==='zh'?'；':'; '),mutationAllowed:false}};}
    yield {type:'done',success:true,usage:usage(),calls,promptVersion:version,result:'success'};return;
  }
  // A free chat has no plan identity to apply. Keep its answer instead of
  // treating an over-eager routing marker as a failed plan generation.
  if(isV3&&!request.context)attachmentKind='none';
  if (!request.adultConfirmed || attachmentKind === 'none') {
    yield { type: 'done', success: true, usage: usage(), calls, promptVersion: version, result: proseNormalized ? 'repaired' : 'success' };
    return;
  }
  yield { type: 'attachment_pending' };
  let retryFailure = '',noChange=false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const call: AssistantCall = { stage: 'attachment', result: 'failed' };
    calls.push(call);
    try {
      if (options.signal?.aborted) throw new Error('ABORTED');
      const retryHint=attempt?(isV3?`Correct only this invalid part: ${retryFailure}. Return the requested minimal intent with candidate codes.`:`${retryFailure}: use exact schema, catalog, context identity and task; do not omit requested attachment`):undefined;
      const attachmentPrompt=buildPrompt(request, 'attachment', version, text, retryHint, attachmentKind);
      const generated = await options.provider.generateAttachment(attachmentPrompt, options.signal);
      Object.assign(call, generated.usage??estimatedUsage(attachmentPrompt,JSON.stringify(generated.content??'')));
      const checked = isV3
        ? assembleAssistantIntent(generated.content, request)
        : repairAssistantAttachment(generated.content, request);
      const expectedType = ({plan:'plan_proposal',today:'today_adjustment',change:'change_proposal',exercise:'exercise_info',review:'review_summary'} as Record<string,string>)[attachmentKind];
      if(!checked.attachment || checked.attachment.type !== expectedType) throw new AssistantProviderError('INVALID_OUTPUT');
      call.result = checked.repaired || attempt ? 'repaired' : 'success';
      if(checked.attachment){
        if(isV3&&checked.attachment.type==='today_adjustment')yield {type:'text_delta',delta:`\n${checked.attachment.summary}`};
        if(isV3&&checked.attachment.type==='change_proposal')yield {type:'text_delta',delta:`\n${checked.attachment.changes.join(request.locale==='zh'?'；':'; ')}`};
        yield { type: 'attachment', attachment: checked.attachment };
      }
      yield { type: 'done', success: true, usage: usage(), calls, promptVersion: version, result: checked.repaired || attempt || proseNormalized ? 'repaired' : 'success' };
      return;
    } catch (error) {
      if(call.inputTokens===undefined||call.outputTokens===undefined){
        Object.assign(call,{inputTokens:estimatedUsage([{role:'user',content:JSON.stringify(request)}],'').inputTokens,outputTokens:3000,usageEstimated:true});
      }
      call.failureCode = failureCode(error, options.signal);
      call.failureDetail=failureDetail(error);
      if(error instanceof Error&&error.message==='NO_APPLICABLE_CHANGE')noChange=true;
      retryFailure = error instanceof AttachmentValidationError ? error.feedback : call.failureCode;
      console.warn('assistant_provider_failure', { stage: 'attachment', code: call.failureCode });
      if (options.signal?.aborted) break;
      if (error instanceof AssistantProviderError && !['INVALID_OUTPUT', 'INVALID_STREAM'].includes(error.code)) break;
    }
  }
  if(isV3 && request.context){
    try{
      const latest=request.messages.at(-1)!.content;
      const minutes=latest.match(/(\d{1,3})\s*(?:分钟|minutes?|mins?)/i);
      const weekly=latest.match(/(?:每周|一周)\s*([1-7一二两三四五六七])\s*次|\b([1-7])\s*(?:times?\s*)?(?:a|per)\s*week|\b(twice|once)\s*(?:a|per)\s*week/i);
      const weekValue=weekly&&({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,once:1,twice:2} as Record<string,number>)[(weekly[1]??weekly[2]??weekly[3]).toLowerCase()]||Number(weekly?.[1]??weekly?.[2]);
      const task=request.context.task;
      const addPush=/加.*(?:推|胸)|add.*(?:push|chest)/i.test(latest);
      const lessEquipment=/少.*器械|less equipment/i.test(latest);
      const candidateList=selectAssistantCandidates(request);
      const plan=task==='MODIFY_PLAN'?request.context.plan:undefined;
      const addCandidate=addPush&&plan?candidateList.find(row=>row.mode==='push'&&!plan.templates.some(template=>template.items.some(item=>item.exerciseId===row.exercise.id))):undefined;
      const equipped=lessEquipment&&plan?plan.templates.flatMap(template=>template.items.map(item=>({template,item}))).find(({item})=>item.equipment!=='none'):undefined;
      const previous=equipped?exercises.find(row=>row.id===equipped.item.exerciseId):undefined;
      const replacement=previous?candidateList.find(row=>row.mode===assistantMovement(previous)&&row.exercise.equipment==='none'):undefined;
      const named=plan?.templates.flatMap(template=>template.items.map(item=>({template,item,exercise:exercises.find(row=>row.id===item.exerciseId)}))).find(row=>row.exercise&&[row.exercise.name.zh,row.exercise.name.en].some(name=>latest.toLocaleLowerCase().includes(name.toLocaleLowerCase())));
      const carrying=plan?.templates.flatMap(template=>template.items.map(item=>({template,item,exercise:exercises.find(row=>row.id===item.exerciseId)}))).find(row=>row.exercise&&assistantMovement(row.exercise)==='carry');
      const unwanted=named??(/农夫行走|farmer.*carry/i.test(latest)?carrying:undefined);
      const safeReplacement=unwanted?.exercise?candidateList.find(row=>(assistantMovement(unwanted.exercise!)==='carry'?['carry','pull','core']:[assistantMovement(unwanted.exercise!)]).includes(row.mode)&&row.exercise.id!==unwanted.item.exerciseId&&!plan?.templates.some(template=>template.items.some(item=>item.exerciseId===row.exercise.id))):undefined;
      const changes=[...(addCandidate&&plan?[{op:'add' as const,session:plan.templates[0].id,to:addCandidate.code}]:[]),...(equipped&&replacement?[{op:'replace' as const,session:equipped.template.id,from:equipped.item.exerciseId,to:replacement.code}]:[]),...(unwanted&&safeReplacement?[{op:'replace' as const,session:unwanted.template.id,from:unwanted.item.exerciseId,to:safeReplacement.code}]:[])];
      const intent=task==='ONBOARD_PLAN'?{kind:'plan_new',params:{...(minutes?{minutesPerSession:Number(minutes[1])}:{}),...(weekValue?{daysPerWeek:weekValue}:{})}}:
        task==='ADJUST_TODAY'?{kind:'today_adjust',minutes:minutes?Number(minutes[1]):Math.max(10,request.context.template.estimatedMinutes-5),...(/只练上半身|只练上肢|upper.body only/i.test(latest)?{focus:'upper' as const}:{})}:
        task==='MODIFY_PLAN'?{kind:'plan_modify',params:{...(weekValue?{daysPerWeek:weekValue}:{}),...(minutes?{minutesPerSession:Number(minutes[1])}:{})},changes}:
        task==='PERIOD_REVIEW'?{kind:'review',highlights:[]}:null;
      if(intent){const fallback=assembleAssistantIntent(intent,request);if(fallback.attachment){if(fallback.attachment.type==='today_adjustment')yield {type:'text_delta',delta:`\n${fallback.attachment.summary}`};if(fallback.attachment.type==='change_proposal')yield {type:'text_delta',delta:`\n${fallback.attachment.changes.join(request.locale==='zh'?'；':'; ')}`};yield {type:'attachment',attachment:fallback.attachment};yield {type:'done',success:true,usage:usage(),calls,promptVersion:version,result:'fallback'};return;}}
    }catch(error){if(error instanceof Error&&error.message==='NO_APPLICABLE_CHANGE')noChange=true; /* An unsafe fallback must not become an applicable card. */ }
  }
  yield { type: 'attachment_failed', code: noChange ? 'NO_CHANGE' : 'ATTACHMENT_UNAVAILABLE' };
  yield { type: 'done', success: false, usage: usage(), calls, promptVersion: version, result: noChange ? 'no_change' : 'attachment_failed' };
}

/** OpenAI-compatible provider. Credential never appears in prompts, events or logs. */
export function createAssistantProvider(options: { apiKey: string; baseUrl: string; model?: string; maxTokens?: number; maxAttachmentTokens?: number; maxInputBytes?: number; fetch?: typeof fetch }): AssistantProvider {
  const send = async (messages: AssistantPromptMessage[], stream: boolean, signal?: AbortSignal) => {
    if(new TextEncoder().encode(JSON.stringify(messages)).byteLength > (options.maxInputBytes ?? 131072)) throw new AssistantProviderError('INVALID_OUTPUT');
    let response: Response;
    try { response = await (options.fetch ?? fetch)(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal, headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model ?? 'deepseek-flash', messages, stream, thinking: { type: 'disabled' }, max_tokens: Math.max(1, Math.min((stream ? options.maxTokens : options.maxAttachmentTokens ?? options.maxTokens) ?? (stream ? 1600 : 3000), 3000)), ...(stream ? { stream_options: { include_usage: true } } : { temperature: 0.1, response_format: { type: 'json_object' } }) }),
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


