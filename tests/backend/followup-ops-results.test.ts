import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { checkCoachLanguage } from '../../src/application/rules/coach-language';
import { adaptCoachResponse } from '../../src/coach/response-adapter';
import type { CoachRequest } from '../../src/coach/contracts';

it.skipIf(!existsSync('.cache/followup-ops-evaluation.json'))('summarizes saved synthetic output offline without model calls',() => {
  const report = JSON.parse(readFileSync('.cache/followup-ops-evaluation.json','utf8')) as {results:Array<{scenario:string;locale:string;repetition:number;request?:CoachRequest;output?:Record<string,unknown>}>};
  const parsed = report.results.filter(result => result.output);
  const summaries = parsed.map(result => {
    const output = result.output!;
    let currentAdapterAccepted = false;
    try { if (result.request) { adaptCoachResponse(result.request,output); currentAdapterAccepted = true; } } catch { /* Report rejection without changing saved model output. */ }
    const strings = (value:unknown):string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
    return {scenario:result.scenario,locale:result.locale,repetition:result.repetition,
      currentAdapterAccepted,bannedCategories:[...new Set(strings(output).flatMap(checkCoachLanguage))],
      reviewFourSteps:output.type === 'review_summary' ? ['opening','encouragement','gap'].every(key => typeof output[key] === 'string' && (output[key] as string).length > 0) && Array.isArray(output.dataBoundary) && output.dataBoundary.length > 0 : undefined};
  });
  writeFileSync('.cache/followup-ops-language-summary.json',JSON.stringify({parsed:parsed.length,currentAdapterAccepted:summaries.filter(result => result.currentAdapterAccepted).length,banned:summaries.filter(result => result.bannedCategories.length),reviews:summaries.filter(result => result.reviewFourSteps !== undefined)},null,2));
  expect(parsed.length).toBeLessThanOrEqual(28);
});
