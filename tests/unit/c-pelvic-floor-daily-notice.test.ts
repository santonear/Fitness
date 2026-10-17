import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {Rules} from '../../src/engine/data';
import {PelvicFloorDailyNotice} from '../../src/ui/pages/training/PelvicFloorDailyNotice';

const context=vi.hoisted(()=>({value:{} as any}));
vi.mock('../../src/ui/mainline/context',()=>({useMainline:()=>context.value}));
const at='2026-10-17T18:00:00.000Z',rules=new Rules();
function fixture(kind:'pregnant'|'postpartum'='pregnant'){
 vi.useFakeTimers();vi.setSystemTime(new Date(at));
 const p=baseProfile({birthYearMonth:'1996-01',population:kind==='pregnant'?{kind,week:8,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:8}:{kind,weeksSinceBirth:30,delivery:'vaginal',cleared:true}});
 context.value={locale:'zh',data:{profile:{timeZone:'Asia/Shanghai'},workouts:[],state:{coachProfile:{goalText:'活动',goal:'health',population:p.population,birthYearMonth:p.birthYearMonth,weeklyTarget:3,sessionMinutes:30,scheduleOriginalText:'',place:'home',equipment:['none'],adultConfirmed:true,cautions:[],confirmedAt:at,healthStorageConsent:{acceptedAt:at},screening:p.screening}}}};
 return context.value.data.state;
}
const render=()=>renderToStaticMarkup(createElement(PelvicFloorDailyNotice));
afterEach(()=>vi.useRealTimers());
it.each(['pregnant','postpartum'] as const)('shows only the existing %s source copy on the local day without AI or plan state',kind=>{
 fixture(kind);const key=kind==='pregnant'?'pregnancy.pelvic_floor.copy':'postpartum.pelvic_floor.copy';
 const html=render();expect(html).toContain('2026-10-18');expect(html).toContain(rules.text(key).zh);expect(html).toContain(key);
 context.value.locale='en';expect(render()).toContain(rules.text(key).en.replaceAll('&','&amp;').replaceAll("'",'&#x27;'));
 vi.setSystemTime(new Date('2026-10-18T18:00:00.000Z'));expect(render()).toContain('2026-10-19');
});
it.each(['cardiacPause','trainingPause','pregnancySafety','postpartumSafety','olderSafety'])('suppresses practice while %s is active',key=>{
 const state=fixture();state[key]=key==='pregnancySafety'?{providerPause:{requiredAt:at}}:key==='postpartumSafety'?{urgentAt:at}:key==='olderSafety'?{reviewRequiredAt:at}:{requiredAt:at};expect(render()).toBe('');
});
it('suppresses regression, missing consent, unknown population and incomplete screening',()=>{
 let s=fixture('postpartum');s.postpartumSafety={regression:{requiredAt:at,phase:1,symptomFreeDates:[]}};expect(render()).toBe('');
 s=fixture();delete s.coachProfile.healthStorageConsent;expect(render()).toBe('');
 s=fixture();delete s.coachProfile.population;expect(render()).toBe('');
 s=fixture();delete s.coachProfile.screening.cmrSymptoms;expect(render()).toBe('');
});
