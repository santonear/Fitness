import { expect, test } from '@playwright/test';

test('analytics counts actual completed facts, filters periods and preserves history', async ({page},testInfo) => {
  await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));
  await page.goto('/');
  await page.getByRole('button',{name:'view your dashboard first'}).click();
  const analytics=page.getByRole('region',{name:'training analytics',exact:true});
  await expect(analytics.getByText('no completed records to analyse yet.').first()).toBeVisible();
  await page.evaluate(async()=>{
    const wp='/src/application/workouts.ts',cp='/src/catalog/exercises.ts',pp='/src/application/profile.ts';
    const {workoutService}=await import(/* @vite-ignore */wp); const {exercises}=await import(/* @vite-ignore */cp); const {profileService}=await import(/* @vite-ignore */pp);
    const profile=await profileService.getProfile();
    for(let i=0;i<4;i++){
      const date=new Date(); if(i===2)date.setDate(date.getDate()-60);
      const localDate=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const timed=i===2;
      const exercise=exercises.find((value:{metricType:string})=>value.metricType===(timed?'duration':'reps_load'));
      const session=await workoutService.startWorkout({sessionId:crypto.randomUUID(),localDate,timeZone:profile.timeZone,exerciseIds:[exercise.id]});
      const result=await workoutService.recordSet(session.id,{id:crypto.randomUUID(),exerciseInstanceId:session.exerciseSnapshots[0].exerciseInstanceId,order:0,completed:true,...(timed?{metricType:'duration',durationSeconds:120}:{metricType:'reps_load',reps:i===1?5:10,loadGrams:i===1?2000:2500})},session.revision);
      if(i<3)await workoutService.completeWorkout(session.id,result.revision);
    }
  });
  const card=(name:string)=>analytics.locator('.analytics-kpis article').filter({has:page.getByRole('heading',{name,exact:true})});
  await expect(card('completed workouts').locator('strong')).toHaveText('3');
  await expect(card('training days').locator('strong')).toHaveText('2');
  await expect(card('recorded volume').locator('strong')).toHaveText('35 kg·reps');
  await expect(card('recorded duration').locator('strong')).toHaveText('2 min');
  const read=()=>page.evaluate(async()=>{const path='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */path);return JSON.stringify([await database.sessions.toArray(),await database.sets.toArray()]);});
  const before=await read();
  await analytics.getByRole('button',{name:'30D',exact:true}).click();
  await expect(card('completed workouts').locator('strong')).toHaveText('2');
  await expect(card('recorded duration').locator('strong')).toHaveText('—');
  await analytics.getByRole('button',{name:'180D',exact:true}).click();
  await expect(card('completed workouts').locator('strong')).toHaveText('3');
  for(const width of [320,375,390,430,768,1024,1280,1440]){
    await page.setViewportSize({width,height:960});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:testInfo.outputPath('analytics-desktop.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'menu',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'analytics navigation'})).toBeVisible();
  await expect(page.getByRole('button',{name:/muscle groups/})).toBeDisabled();
  await page.screenshot({path:testInfo.outputPath('analytics-navigation-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'menu',exact:true}).click();
  await analytics.screenshot({path:testInfo.outputPath('analytics-mobile.png')});
  expect(await read()).toBe(before);
});
