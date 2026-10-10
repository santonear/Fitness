import { afterAll, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { coachEvaluationPlan, evaluateCoachV8Response } from '../../src/backend/coach-v8-evaluation';
import { coachEvaluationFixture } from '../../src/backend/coach-evaluation-fixtures';
import { coachV8ProviderPrompt } from '../../src/backend/coach-v8-provider';

// Explicit opt-in only; CI and ordinary test runs never spend money.
const enabled = process.env.FITNESS_RUN_PAID_EVAL === 'approved-28-calls-10-cny';
const results: unknown[] = [];
let calls = 0, reservedFen = 0, stopped = false;
afterAll(() => { if (enabled) { mkdirSync('.cache',{recursive:true}); writeFileSync('.cache/followup-ops-evaluation.json',JSON.stringify({calls,reservedFen,results},null,2)); } });
it.skipIf(!enabled).each(coachEvaluationPlan)('bounded synthetic $scenario $locale $repetition', async entry => {
  if (stopped) throw new Error('EVALUATION_STOPPED_NO_RETRY');
  const request = coachEvaluationFixture(entry.scenario,entry.locale);
  if (entry.scenario === 'under-18') {
    const result = evaluateCoachV8Response(entry.scenario,request,undefined);
    results.push({...entry,...result,modelCalled:false}); expect(result.passed).toBe(true); return;
  }
  if (!process.env.DEEPSEEK_API_KEY) { stopped = true; throw new Error('EVALUATION_CREDENTIAL_UNAVAILABLE'); }
  const messages = coachV8ProviderPrompt(request);
  const bytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  // UTF8 byte upper bound plus framing reserve, charged at verified peak prices
  // CNY 2/M input and CNY 8/M output. Keep reservations even on ambiguous failures.
  const inputBound = bytes + 1024;
  const boundFen = Math.ceil((inputBound * 200 + 2000 * 800) / 1_000_000);
  if (inputBound > 65536 || calls >= 28 || reservedFen + boundFen > 1000) { stopped = true; throw new Error('EVALUATION_BUDGET_LIMIT'); }
  calls++; reservedFen += boundFen;
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(55000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.DEEPSEEK_API_KEY}`},body:JSON.stringify({model:'deepseek-flash',messages,thinking:{type:'disabled'},max_tokens:2000,response_format:{type:'json_object'},stream:false})});
    if (!response.ok) throw new Error('EVALUATION_PROVIDER_FAILED');
    const data = await response.json() as {choices?:{finish_reason?:string;message?:{content?:string}}[];usage?:{prompt_tokens?:number;completion_tokens?:number}};
    if ((data.usage?.prompt_tokens ?? Infinity) > inputBound || (data.usage?.completion_tokens ?? Infinity) > 2000) throw new Error('EVALUATION_USAGE_INVALID');
    const content = data.choices?.[0]?.message?.content;
    if (!content || data.choices?.[0]?.finish_reason !== 'stop') throw new Error('EVALUATION_RESPONSE_INCOMPLETE');
    const output: unknown = JSON.parse(content);
    results.push({...entry,...evaluateCoachV8Response(entry.scenario,request,output),modelCalled:true,usage:data.usage,output});
  } catch { stopped = true; results.push({...entry,modelCalled:true,error:'EVALUATION_INTERRUPTED'}); throw new Error('EVALUATION_INTERRUPTED_NO_RETRY'); }
},60000);
