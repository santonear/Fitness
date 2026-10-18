import {test,expect} from '@playwright/test';
test('actual onboarding applies an environment plan and starts and the settings support switch restores balance in a new version',async({page})=>{
 await page.route('**/api/v1/features',route=>route.fulfill({json:{version:1,flags:{trainingEngine:true,aiAssistantV2:false,bodyProfile:false},expiresAt:Date.now()+3600000}}));
 await page.route('**/api/v1/trial/access-status',route=>route.fulfill({json:{qualification:'none',sessionValid:false,aiEnabled:false}}));
 await page.clock.setFixedTime(new Date('2026-10-16T10:00:00.000Z'));await page.goto('/');await expect(page).toHaveURL(/onboarding/);
 // Enter a real outdoor older-adult profile through production onboarding controls.
 for(const answer of ['保持活动','每周3次，每次30分钟','户外，徒手']){await page.getByLabel('你的回答',{exact:true}).fill(answer);await page.getByRole('button',{name:'继续',exact:true}).click();}
 await page.getByRole('checkbox',{name:/同意将运动前自查/}).check();await page.getByLabel('出生年月',{exact:true}).fill('1956-01');
 const questions=page.getByRole('group',{name:'PAR-Q+',exact:true}).getByRole('combobox');await expect(questions).toHaveCount(20);
 for(let index=0;index<18;index++)await questions.nth(index).selectOption('false');
 await questions.nth(18).selectOption('active');await questions.nth(19).selectOption('known_below_threshold');
 await page.getByRole('combobox',{name:/孕期 \/ 产后状态/}).selectOption('general');await expect(page.getByRole('combobox',{name:/孕期 \/ 产后状态/}).getByRole('option',{name:/65|及以上/})).toHaveCount(0);
 const falls=page.getByRole('group',{name:'为了把平衡练习安排得更稳妥，想先问你 4 个简单的问题。',exact:true}).getByRole('combobox');await expect(falls).toHaveCount(4);
 for(let index=0;index<4;index++)await falls.nth(index).selectOption(index===1?'true':'false');
 await page.getByRole('checkbox',{name:'不能跳',exact:true}).check();await page.getByRole('checkbox',{name:'保持安静',exact:true}).check();
 await page.getByLabel('我已年满 18 岁',{exact:true}).check();await page.getByRole('button',{name:'生成新计划',exact:true}).click();
 await expect(page.getByRole('heading',{name:'你的第一版计划',exact:true})).toBeVisible();
 await expect(page.getByText(/平衡练习需要一个能扶的地方/).first()).toBeVisible();
 const apply=page.getByRole('button',{name:'就用这份计划',exact:true});await expect(apply).toBeEnabled();await apply.click();await expect(page).toHaveURL(/\/$/);
 const first=await page.evaluate(async()=>{const path='/src/ui/mainline/context.tsx',context=await import(/* @vite-ignore */path),snapshot=await context.workflow.snapshot();if(snapshot.version?.enginePlan?.quality?.status!=='environmentLimited')throw Error('Actual UI-applied draft must retain its environment claim');return snapshot.version.id;});
 await page.goto('/plans');const disclosure=page.getByRole('button',{name:/平衡练习需要一个能扶的地方/});await expect(disclosure).toBeVisible();await disclosure.click();await expect(page).toHaveURL(/settings\/engine#environment/);
 const support=page.getByRole('checkbox',{name:'家里有可扶的墙或椅子',exact:true});await expect(support).not.toBeChecked();
 await page.goto('/');const start=page.getByRole('button',{name:'开始训练',exact:true});await expect(start).toBeEnabled();await start.click();await expect(page).toHaveURL(/workout\//);
 await page.goto('/settings/engine#environment');await page.getByRole('checkbox',{name:'家里有可扶的墙或椅子',exact:true}).check();await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page).toHaveURL(/\/settings$/);
 await page.goto('/plans');await expect(page.getByRole('button',{name:/平衡练习需要一个能扶的地方/})).toHaveCount(0);
 const snapshot=await page.evaluate(async()=>{const path='/src/ui/mainline/context.tsx',c=await import(/* @vite-ignore */path),s=await c.workflow.snapshot();return{version:s.version,versions:s.versions,workouts:s.workouts};});
 expect(snapshot.version.basedOnVersionId).toBe(first);expect(snapshot.versions).toHaveLength(2);expect(snapshot.workouts[0].planVersionId).toBe(first);expect(snapshot.version.templates.every((t:{items:{prescription?:{pattern:string}}[]})=>t.items.some(i=>i.prescription?.pattern==='balance'))).toBe(true);
});
