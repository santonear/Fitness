import {test, expect} from '@playwright/test';

test('local referral leaves chat unchanged, discloses no detector metadata and dismisses per conversation', async ({page}) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/api/v1/assistant/chat', async route => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({contentType:'text/event-stream', body:'data: {"type":"text_delta","delta":"收到。"}\n\ndata: {"type":"done","success":true,"usage":{"inputTokens":1,"outputTokens":1},"promptVersion":"test"}\n\n'});
  });
  await page.goto('/tests/fixtures/v8-coach/index.html');
  await page.evaluate(async () => {
    const path='/src/application/feature-flags.ts';
    await (await import(/* @vite-ignore */ path)).refreshFeatureFlags(async () => Response.json({version:1,flags:{aiAssistantV2:true,trainingEngine:true},expiresAt:Date.now()+60000}));
  });
  await page.evaluate(async()=>{
    const initializationPath='/src/application/profile.ts';
    await (await import(/* @vite-ignore */ initializationPath)).profileService.initialize('zh');
    const repositoryPath='/src/persistence/repository.ts',profilePath='/src/application/rules/local-profile.ts',schemaPath='/src/domain/schemas.ts';
    const {repository}=await import(/* @vite-ignore */ repositoryPath);
    const {localProfile}=await import(/* @vite-ignore */ profilePath);
    const {v8StateSchema}=await import(/* @vite-ignore */ schemaPath);
    const profile=localProfile({goalText:'规律活动',scheduleOriginalText:'每周三次，每次30分钟',placeEquipmentText:'在家徒手',adultConfirmed:true,cautions:[]});
    const seeded=v8StateSchema.safeParse({id:'v8',legacyPlanIds:[],migratedAt:'2026-10-18T00:00:00.000Z',notice:{planCount:0,acknowledged:true},coachProfile:{...profile,population:{kind:'general'},birthYearMonth:'1986-07',healthStorageConsent:{acceptedAt:'2026-10-18T00:00:00.000Z'},screening:{parqAllNo:true,knownCondition:false,symptoms:false,parqAnswers:[false,false,false,false,false,false,false],completedAt:'2026-10-18T00:00:00.000Z'}}});
    if(!seeded.success)throw new Error(JSON.stringify(seeded.error.issues));
    await repository.db.v8State.put(seeded.data);
  });
  await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('我怀孕了');
  await dialog.getByRole('button',{name:'发送',exact:true}).click();
  await expect(page.getByRole('log').getByText('收到。')).toBeVisible();
  await expect(dialog.getByRole('link',{name:'去更新'})).toHaveAttribute('href','/settings/engine');
  const referral=dialog.getByRole('status').filter({hasText:'你的身体状况可能有变化。'});
  expect(await referral.evaluate(element=>element.nextElementSibling?.classList.contains('assistant-bubble--assistant'))).toBe(true);
  expect(JSON.stringify(sent[0])).toContain('我怀孕了');
  expect(JSON.stringify(sent[0])).not.toContain('1986-07');
  for (const key of ['bodyChange','detected','matchedKeywords','prenatalCareConfirmed','parqAnswers','birthYearMonth'])
    expect(JSON.stringify(sent[0])).not.toContain(`"${key}"`);
  await dialog.getByRole('button',{name:'不是我'}).click();
  await dialog.getByRole('textbox').fill('我怀孕了，想问问训练');
  await dialog.getByRole('button',{name:'发送',exact:true}).click();
  await expect(page.getByRole('log').getByText('收到。')).toHaveCount(2);
  await expect(dialog.getByRole('link',{name:'去更新'})).toHaveCount(0);
  expect(sent).toHaveLength(2);
  await dialog.getByRole('button',{name:'新对话',exact:true}).click();
  await dialog.getByRole('textbox').fill('我怀孕了');
  await dialog.getByRole('button',{name:'发送',exact:true}).click();
  await expect(dialog.getByRole('link',{name:'去更新'})).toBeVisible();
  await dialog.getByRole('link',{name:'去更新'}).click();
  await expect(page).toHaveURL(/\/settings\/engine$/);
  await expect(page.getByRole('combobox',{name:'孕期 / 产后状态',exact:true})).toBeVisible();
});
