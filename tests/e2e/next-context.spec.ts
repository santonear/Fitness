import { test, expect } from '@playwright/test';
test('AI context and candidate save are read-only until one atomic provenance-preserving save', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path='/tests/e2e/helpers/next-context-browser.ts';
    return (await import(/* @vite-ignore */ path)).runContextContract();
  });
  expect(result.feature).toBe(true);
  expect(result.readOnly).toBe(true);
  expect(result.historyExact).toBe(true);
  expect(result.saved).toBe(true);
  expect(result.replay).toBe('CONFLICT');
});

const scenarios:Record<string,unknown>={
  'ongoing-released':{code:'CONFLICT',count:1},'legacy-profile':{code:'accepted',count:1},'malformed-history':{codes:['INVALID','INVALID','INVALID','CONFLICT'],count:0},'completed-hidden':{code:'CONFLICT',count:2},
  'invalid-and-retry':{invalidDate:'INVALID',metrics:'INVALID',invalidCandidate:'INVALID_CANDIDATE',malformed:'INVALID',unchanged:true,count:1},
  restore:{code:'CONFLICT',count:0},timezone:{code:'CONFLICT',count:0},conditions:{code:'CONFLICT',count:0},slot:{code:'CONFLICT',count:1},
  history:{unrelated:'accepted',relevant:'CONFLICT',count:1},atomic:{failed:'STORAGE_FULL',rolledBack:true,count:1},budget:{failed:'INVALID',unchanged:true},fidelity:{unchanged:true,replay:'CONFLICT',added:1},
};
for(const [scenario,expected] of Object.entries(scenarios))test(`AI candidate safety: ${scenario}`,async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async scenario=>{const path='/tests/e2e/helpers/next-context-browser.ts';return(await import(/* @vite-ignore */ path)).runSafetyScenario(scenario);},scenario);
  expect(result).toEqual(expected);
});
