import { expect, test } from '@playwright/test';

test('analytics counts actual completed facts, filters periods and preserves history', async ({page},testInfo) => {
  await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));
  await page.goto('/progress');

  const analytics=page.locator('.v31-progress');
  await expect(analytics.getByText('No completed training in this selection.',{exact:true})).toBeVisible();
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
  await analytics.getByRole('button',{name:'90 days',exact:true}).click();
  const card=(name:string)=>analytics.locator('.v31-metric').filter({has:page.getByText(name,{exact:true})});
  await expect(card('Completed workouts').locator('strong')).toHaveText('3');
  await page.getByText('View chart data',{exact:true}).click();
  await expect(page.locator('.v31-chart-data li')).toHaveCount(2);
  await expect(card('Recorded volume').locator('strong')).toHaveText('35 kg·reps');
  await expect(card('Total recorded duration').locator('strong')).toHaveText('2 min');
  const read=()=>page.evaluate(async()=>{const path='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */path);return JSON.stringify([await database.sessions.toArray(),await database.sets.toArray()]);});
  const before=await read();
  await analytics.getByRole('button',{name:'30 days',exact:true}).click();
  await expect(card('Completed workouts').locator('strong')).toHaveText('2');
  await expect(card('Total recorded duration').locator('strong')).toHaveText('—');
  await analytics.getByRole('button',{name:'180 days',exact:true}).click();
  await expect(card('Completed workouts').locator('strong')).toHaveText('3');
  for(const width of [320,375,390,430,768,1024,1280,1440]){
    await page.setViewportSize({width,height:960});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:testInfo.outputPath('analytics-desktop.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('navigation',{name:'Bottom navigation',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Bottom navigation',exact:true}).getByRole('link')).toHaveCount(5);
  await page.screenshot({path:testInfo.outputPath('analytics-navigation-mobile.png'),fullPage:true});
  await analytics.screenshot({path:testInfo.outputPath('analytics-mobile.png')});
  expect(await read()).toBe(before);
});
