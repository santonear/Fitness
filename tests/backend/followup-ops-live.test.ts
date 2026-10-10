import { afterAll, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { coachEvaluationPlan, evaluateCoachV8Response } from '../../src/backend/coach-v8-evaluation';
import { coachEvaluationFixture } from '../../src/backend/coach-evaluation-fixtures';
import { coachV8ProviderPrompt } from '../../src/backend/coach-v8-provider';

// Explicit opt-in only; CI and ordinary test runs never spend money.
const enabled = process.env.FITNESS_RUN_PAID_EVAL === 'approved-28-calls-10-cny';
type Saved = {calls:number;reservedFen:number;results:Record<string,unknown>[]};
const saved: Saved = enabled && existsSync('.cache/followup-ops-evaluation.json') ? JSON.parse(readFileSync('.cache/followup-ops-evaluation.json','utf8')) as Saved : {calls:0,reservedFen:0,results:[]};
const results = saved.results;
let calls = saved.calls, reservedFen = saved.reservedFen, stopped = false;
if (!Number.isSafeInteger(calls) || calls < 0 || calls > 28 || !Number.isSafeInteger(reservedFen) || reservedFen < 0 || reservedFen > 1000 || !Array.isArray(results)) throw new Error('EVALUATION_LEDGER_INVALID');
const persist = () => { if (enabled) { mkdirSync('.cache',{recursive:true}); writeFileSync('.cache/followup-ops-evaluation.json',JSON.stringify({calls,reservedFen,results},null,2)); } };
afterAll(persist);
it.skipIf(!enabled).each(coachEvaluationPlan)('bounded synthetic $scenario $locale $repetition', async entry => {
  if (results.some(result => result.scenario === entry.scenario && result.locale === entry.locale && result.repetition === entry.repetition)) return;
  const request = coachEvaluationFixture(entry.scenario,entry.locale);
  if (entry.scenario === 'under-18') {
    const result = evaluateCoachV8Response(entry.scenario,request,undefined);
    results.push({...entry,...result,modelCalled:false}); persist(); expect(result.passed).toBe(true); return;
  }
  if (stopped) throw new Error('EVALUATION_STOPPED_NO_RETRY');
  if (!process.env.DEEPSEEK_API_KEY) { stopped = true; throw new Error('EVALUATION_CREDENTIAL_UNAVAILABLE'); }
  const messages = coachV8ProviderPrompt(request);
  const bytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  // UTF8 byte upper bound plus framing reserve, charged at verified peak prices
  // CNY 2/M input and CNY 8/M output. Keep reservations even on ambiguous failures.
  const inputBound = bytes + 1024;
  const boundFen = Math.ceil((inputBound * 200 + 2000 * 800) / 1_000_000);
  if (inputBound > 65536 || calls >= 28 || reservedFen + boundFen > 1000) { stopped = true; throw new Error('EVALUATION_BUDGET_LIMIT'); }
  calls++; reservedFen += boundFen;
  const pending: Record<string,unknown> = {...entry,modelCalled:true,status:'reserved',request,inputTokenBound:inputBound,boundFen};
  results.push(pending); persist();
  const started = Date.now();
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(55000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.DEEPSEEK_API_KEY}`},body:JSON.stringify({model:'deepseek-flash',messages,thinking:{type:'disabled'},max_tokens:2000,response_format:{type:'json_object'},stream:false})});
    pending.httpStatus = response.status; persist();
    if (!response.ok) throw new Error('EVALUATION_PROVIDER_FAILED');
    const data = await response.json() as {choices?:{finish_reason?:string;message?:{content?:string}}[];usage?:{prompt_tokens?:number;completion_tokens?:number}};
    pending.usage = data.usage; pending.finishReason = data.choices?.[0]?.finish_reason;
    pending.rawOutput = data.choices?.[0]?.message?.content; persist();
    if ((data.usage?.prompt_tokens ?? Infinity) > inputBound || (data.usage?.completion_tokens ?? Infinity) > 2000) throw new Error('EVALUATION_USAGE_INVALID');
    const content = data.choices?.[0]?.message?.content;
    if (!content || data.choices?.[0]?.finish_reason !== 'stop') throw new Error('EVALUATION_RESPONSE_INCOMPLETE');
    let output: unknown;
    try { output = JSON.parse(content); } catch {
      Object.assign(pending,{status:'invalid-output',structuralGate:'fail',error:'INVALID_JSON',latencyMs:Date.now()-started}); persist(); return;
    }
    Object.assign(pending,{...evaluateCoachV8Response(entry.scenario,request,output),status:'completed',latencyMs:Date.now()-started,usage:data.usage,output}); persist();
  } catch (error) { stopped = true;
    const cause = error instanceof Error ? (error.cause as {code?:unknown}|undefined)?.code : undefined;
    const code = typeof cause === 'string' && ['ENOTFOUND','EPERM','EACCES','ECONNRESET','ETIMEDOUT'].includes(cause) ? cause : error instanceof Error && ['EVALUATION_PROVIDER_FAILED','EVALUATION_USAGE_INVALID','EVALUATION_RESPONSE_INCOMPLETE'].includes(error.message) ? error.message : 'PROVIDER_OR_TRANSPORT_FAILURE';
    Object.assign(pending,{status:'interrupted',latencyMs:Date.now()-started,error:code}); persist(); throw new Error('EVALUATION_INTERRUPTED_NO_RETRY'); }
},60000);
