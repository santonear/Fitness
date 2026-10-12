export type EvaluationResult = {
  scenarioId?: string;
  promptVersion?: string;
  outputText?: string;
  score?: { automatedPass: boolean };
  events?: Array<{ type: string; result?: string; delta?: string; promptVersion?: string; calls?: Array<{ result?: string }> }>;
  actualCny?: number;
  latencyMs?: number;
  costIsUpperBound?: boolean;
};
export function promptByteBounds(build:(stage:'text'|'attachment',attempt:0|1)=>unknown) {
  return [0,1,2].map(index=>Buffer.byteLength(JSON.stringify(build(index===0?'text':'attachment',index===2?1:0)),'utf8')+1024);
}
const internalTerms = /训练卡模板|本地确认|在你的设备上确认|已完成记录不会改动|剩余\s*\d+\s*组|\(equipment:|\bduration\)|\bcatalog\b|preview only/gi;
function repeated(text: string) {
  const normalized=text.trim().replace(/\s+/g,' ');
  const half=Math.floor(normalized.length/2);
  return normalized.length>=50 && normalized.slice(0,half-8)===normalized.slice(half,half+half-8);
}

const ratio = (numerator: number, denominator: number) => ({ numerator, denominator, percent: denominator ? Number((numerator / denominator * 100).toFixed(2)) : null });

/** Report only attempted scenarios; missing/unknown usage never becomes a zero-cost call. */
export function summarizeAssistantEvaluation(results: EvaluationResult[]) {
  const attempted = results.filter(result => Array.isArray(result.events));
  const usable = attempted.filter(result => result.score?.automatedPass);
  const outcome = (result: EvaluationResult) => [...(result.events ?? [])].reverse().find(event => event.type === 'done');
  const firstPass = usable.filter(result => {
    const done = outcome(result);
    return done?.result === 'success' || !done?.result && done?.calls?.every(call => call.result === 'success');
  });
  const repaired = usable.filter(result => outcome(result)?.result === 'repaired');
  const fallback = usable.filter(result => outcome(result)?.result === 'fallback');
  const measured = attempted.filter(result => Number.isFinite(result.actualCny) && !result.costIsUpperBound);
  const latency = attempted.map(result => result.latencyMs).filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 0).sort((a,b) => a-b);
  const actualCostCny = measured.reduce((sum,result) => sum + result.actualCny!,0);
  const texts=attempted.map(result=>result.outputText ?? result.events?.filter(event=>event.type==='text_delta').map(event=>event.delta??'').join('') ?? '');
  const lengths=texts.map(text=>[...text].length).sort((a,b)=>a-b);
  return {
    attempted: attempted.length,
    final_usable_rate: ratio(usable.length,attempted.length),
    first_pass_rate: ratio(firstPass.length,attempted.length),
    repair_rate: ratio(repaired.length,attempted.length),
    fallback_rate: ratio(fallback.length,attempted.length),
    actualCostCny,
    measuredCostCalls: measured.length,
    unknownCostCalls: attempted.length-measured.length,
    latencyMs: { mean: latency.length ? latency.reduce((a,b)=>a+b,0)/latency.length : null, p95: latency.length ? latency[Math.ceil(latency.length*0.95)-1] : null, samples: latency.length },
    internalTermOccurrences: texts.reduce((sum,text)=>sum+[...text.matchAll(internalTerms)].length,0),
    repeatedAnswers: texts.filter(repeated).length,
    medianReplyLength: lengths.length ? (lengths[Math.floor((lengths.length-1)/2)]+lengths[Math.ceil((lengths.length-1)/2)])/2 : null,
  };
}

/** A/B comparison uses only scenario IDs attempted by both prompt versions. */
export function compareAssistantPromptVersions(results: EvaluationResult[], versionA = 'assistant-v2.1.0', versionB = 'assistant-v3.0.0') {
  const versionOf=(result:EvaluationResult)=>result.promptVersion??result.events?.find(event=>event.type==='done')?.promptVersion;
  const a=new Map(results.filter(result=>versionOf(result)===versionA && result.scenarioId).map(result=>[result.scenarioId!,result]));
  const b=new Map(results.filter(result=>versionOf(result)===versionB && result.scenarioId).map(result=>[result.scenarioId!,result]));
  const common=[...a.keys()].filter(id=>b.has(id));
  const base=summarizeAssistantEvaluation(common.map(id=>a.get(id)!));
  const candidate=summarizeAssistantEvaluation(common.map(id=>b.get(id)!));
  const delta=(key:'final_usable_rate'|'first_pass_rate'|'repair_rate'|'fallback_rate')=>candidate[key].percent===null||base[key].percent===null?null:Number((candidate[key].percent!-base[key].percent!).toFixed(2));
  return {versions:[versionA,versionB],sharedScenarios:common.length,missingInA:[...b.keys()].filter(id=>!a.has(id)),missingInB:[...a.keys()].filter(id=>!b.has(id)),baseline:base,candidate,deltaPercentagePoints:{final_usable_rate:delta('final_usable_rate'),first_pass_rate:delta('first_pass_rate'),repair_rate:delta('repair_rate'),fallback_rate:delta('fallback_rate')}};
}
