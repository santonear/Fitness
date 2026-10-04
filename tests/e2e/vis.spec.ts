import {test,expect,type Page} from '@playwright/test';
async function facts(page:Page){return page.evaluate(async()=>{const {database}=await import(String('/src/persistence/db.ts'));return JSON.stringify(await Promise.all([database.planVersions,database.scheduledWorkouts,database.sessions,database.sets,database.trainingMemo].map(t=>t.toArray())));});}
test.beforeEach(async({page})=>{
 await page.goto('/');
 await expect.poll(()=>page.evaluate(async()=>{const {database}=await import(String('/src/persistence/db.ts'));return database.profiles.count();})).toBe(1);
 await page.evaluate(async()=>{
  const {dayPlanService}=await import(String('/src/application/day-plans.ts'));
  const {workoutService}=await import(String('/src/application/workouts.ts'));
  const {exercises}=await import(String('/src/catalog/exercises.ts'));
  const {profileService}=await import(String('/src/application/profile.ts'));
  const profile=await profileService.getProfile(); await profileService.saveProfile({locale:'en',timeZone:'UTC',units:'metric'},profile.revision);
  const targets=[[{metricType:'reps_load',reps:8,loadGrams:1250},{metricType:'reps_load',reps:12,loadGrams:0}],[{metricType:'duration_distance',durationSeconds:90,distanceMeters:1500},{metricType:'duration_distance',durationSeconds:60},{metricType:'duration_distance',durationSeconds:30,distanceMeters:0}],[{metricType:'reps',reps:7}],[{metricType:'duration',durationSeconds:90}]];
  const day=await dayPlanService.saveDayPlan({name:'VIS snapshot',date:'2026-10-05',timeZone:'UTC',exercises:exercises.map((e: {id:string},order:number)=>({exerciseId:e.id,order,targetSets:targets[order],notes:'中文 English\n<script>window.visUnsafe=true</script>\n'+'Long text '.repeat(100)}))});
  let session=await workoutService.startWorkout({sessionId:crypto.randomUUID(),scheduledWorkoutId:day.task.id,localDate:'2026-10-05',timeZone:'UTC'});
  await workoutService.recordSet(session.id,{id:crypto.randomUUID(),exerciseInstanceId:session.exerciseSnapshots[0].exerciseInstanceId,order:0,metricType:'reps_load',reps:5,loadGrams:0,completed:true,notes:'Saved 原文\nsecond line'},session.revision);
 });
});
test('snapshot targets and notes are read-only, responsive, offline and localized in Today and Workout',async({page,context})=>{
 for(const path of ['/','/workout']){
  await page.goto(path); const a=page.locator('.workout-exercise').first(); await expect(a).toContainText('2 sets'); const before=await facts(page);
  for(const locale of ['en','zh']){
   await page.getByLabel(/Language|语言/, {exact:true}).selectOption(locale);
   for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   for(const details of await page.locator('.exercise-targets details').all()) await details.evaluate(e=>(e as HTMLDetailsElement).open=true);
   await expect(a).toContainText(locale==='zh'?'8 次 · 1.25 kg':'8 reps · 1.25 kg'); await expect(a).toContainText(locale==='zh'?'12 次 · 0 kg':'12 reps · 0 kg');
   await expect(page.locator('.workout-exercise').nth(1)).toContainText(locale==='zh'?'距离未设置':'Distance not set');
   await expect(page.locator('.workout-exercise').nth(1)).toContainText('30 s · 0 km');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
  }
  await page.getByLabel(/Language|语言/, {exact:true}).selectOption('en');
  expect(await facts(page)).toBe(before); expect(await page.evaluate(()=> 'visUnsafe' in window)).toBe(false);
 }
 const a=page.locator('.workout-exercise').first(), next=a.getByRole('group',{name:'Next set',exact:true});
 await next.getByLabel('Set notes',{exact:true}).fill('Draft 原文');
 await expect(a).toContainText('Saved set notes: Saved 原文');
 await page.getByLabel('Language',{exact:true}).selectOption('zh');
 await expect(a.getByRole('group',{name:'下一组',exact:true}).getByLabel('组备注',{exact:true})).toHaveValue('Draft 原文');
 await expect(a).toContainText('计划目标（非实际记录）'); await expect(a).toContainText('本组输入尚未保存');
 const before=await facts(page); await context.setOffline(true); await a.getByText('计划目标（非实际记录）',{exact:false}).click(); await a.getByText('计划目标（非实际记录）',{exact:false}).click(); await expect(a).toContainText('8 次 · 1.25 kg'); expect(await facts(page)).toBe(before);
});
test('same and cross metric replacement label retained reference, original notes and absent targets',async({page})=>{
 await page.goto('/workout'); const a=page.locator('.workout-exercise').nth(2);
 await page.evaluate(async()=>{
  const {workoutService}=await import(String('/src/application/workouts.ts')); const session=await workoutService.getActiveWorkout();
  await workoutService.adjustWorkout(session.id,{type:'replace_exercise',exerciseInstanceId:session.exerciseSnapshots[2].exerciseInstanceId,exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',confirmClearMetrics:false},session.revision);
 });
 await page.reload();
 await expect(a).toContainText('Original exercise reference targets'); await expect(a).toContainText('Original exercise plan notes');
 await a.getByRole('combobox',{name:'Replace exercise',exact:true}).selectOption('d16325d9-fc00-4c41-88a1-000000000004');
 await expect(a).toContainText('No targets set for this exercise'); await expect(a).toContainText('Original exercise plan notes');
 expect(await a.getByLabel('Set notes',{exact:true}).inputValue()).toBe('');
});
test('another date uses its own snapshot; added and temporary exercises have no fabricated targets',async({page})=>{
 await page.evaluate(async()=>{
  const {workoutService}=await import(String('/src/application/workouts.ts')); const {dayPlanService}=await import(String('/src/application/day-plans.ts'));
  const active=await workoutService.getActiveWorkout(); await workoutService.completeWorkout(active.id,active.revision);
  const day=await dayPlanService.saveDayPlan({name:'Another date',date:'2026-10-12',timeZone:'UTC',exercises:[{exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',order:0,targetSets:[{metricType:'reps',reps:77}],notes:'Other date notes'}]});
  const session=await workoutService.startWorkout({sessionId:crypto.randomUUID(),scheduledWorkoutId:day.task.id,localDate:'2026-10-12',timeZone:'UTC'});
  await workoutService.adjustWorkout(session.id,{type:'add_exercise',exerciseId:'d16325d9-fc00-4c41-88a1-000000000004',exerciseInstanceId:crypto.randomUUID()},session.revision);
 });
 await page.goto('/workout'); const first=page.locator('.workout-exercise').first(); await first.locator('summary').first().click();
 await expect(first).toContainText('77 reps'); await expect(first).toContainText('Other date notes');
 await expect(page.locator('.workout-exercise').nth(1)).toContainText('No targets set for this exercise');
 const before=await facts(page); await first.locator('summary').first().click(); expect(await facts(page)).toBe(before);
 await page.evaluate(async()=>{const {workoutService}=await import(String('/src/application/workouts.ts')); const active=await workoutService.getActiveWorkout(); await workoutService.abandonWorkout(active.id,active.revision); await workoutService.startWorkout({sessionId:crypto.randomUUID(),localDate:'2026-10-13',timeZone:'UTC',exerciseIds:['d16325d9-fc00-4c41-88a1-000000000003']});});
 await page.reload(); await expect(page.locator('.workout-exercise')).toContainText('No targets set for this exercise');
 await expect(page.locator('.exercise-targets ol')).toHaveCount(0);
});
