import {describe,it,expect} from 'vitest';
import {defaultCoachPreferences,userReminderSources,eligibleReminder,type CoachLedger} from '../../src/domain/coach-reminders';
describe('V8 explicit user reminders',()=>{
 it('defaults off with no inferred schedule',()=>{const p=defaultCoachPreferences('Asia/Shanghai');expect(p.enabled).toBe(false);expect(userReminderSources(Date.now(),p)).toEqual([]);});
 it('honors visible quiet hours and daily limits; 06:00 works after explicitly adjusting quiet hours',()=>{
  const now=Date.parse('2026-10-08T22:00:00Z'),p={...defaultCoachPreferences('Asia/Shanghai'),enabled:true,weekdays:[5],time:'06:00'};
  expect(p.dailyLimit).toBe(1);
  const l:CoachLedger={id:'a',preferences:p,records:[],watermark:0,snoozeUntil:0,generation:0,initializedAt:now};
  const c={now,generation:0,profileId:'a',foreground:true,focused:true,training:false,onboarding:false,chat:false,modal:false,idleSince:now};
  const sources=userReminderSources(now,p);expect(eligibleReminder(sources,l,c)).toBeUndefined();
  l.preferences.quietEnd='06:00';expect(eligibleReminder(sources,l,c)).toEqual(sources[0]);
  l.preferences.dailyLimit=0;expect(eligibleReminder(sources,l,c)).toBeUndefined();
 });
 it('uses selected weekday and exact one-hour window only',()=>{
  const now=Date.parse('2026-10-09T04:00:00Z'),p={...defaultCoachPreferences('Asia/Shanghai'),enabled:true,weekdays:[5],time:'12:00'};
  const sources=userReminderSources(now,p);expect(sources).toHaveLength(1);expect(sources[0].from).toBe(now);expect(sources[0].until).toBe(now+3600000);
  expect(userReminderSources(now,{...p,weekdays:[4]})).toEqual([]);
  const l:CoachLedger={id:'a',preferences:p,records:[],watermark:0,snoozeUntil:0,generation:0,initializedAt:now};
  const c={now,generation:0,profileId:'a',foreground:true,focused:true,training:false,onboarding:false,chat:false,modal:false,idleSince:now};
  expect(eligibleReminder(sources,l,c)).toEqual(sources[0]);expect(eligibleReminder(sources,l,{...c,now:now+3600001})).toBeUndefined();expect(eligibleReminder(sources,l,{...c,foreground:false})).toBeUndefined();
 });
});
