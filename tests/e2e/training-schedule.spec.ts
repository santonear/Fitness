import { test, expect } from '@playwright/test';
test('confirmed times survive complete backup; stale changes and active history remain protected',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{const path='/tests/e2e/training-schedule-browser.ts';const {verifySchedule}=await import(/* @vite-ignore */ path);return verifySchedule();});
  expect(result).toEqual({initial:['12:00','14:00','09:00','20:00'],midnight:true,stale:true,restoreStale:true,activeProtected:true,historyPreserved:true,planContextProtected:true,version:7,metadata:9,times:['14:00','14:00','09:00','20:00'],programRevision:1,event:'rescheduled',estimated:[{durationSeconds:40,restSeconds:60}]});
});
test('version 4 plans retain unknown times until explicitly scheduled',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{const path='/tests/e2e/training-schedule-browser.ts';const {verifyLegacyTime}=await import(/* @vite-ignore */ path);return verifyLegacyTime();});
  expect(result).toEqual({unknown:true,start:'09:00',duration:30,setsPreserved:true});
});
