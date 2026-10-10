import { describe,expect,it } from 'vitest';
import { basicProposal } from '../../src/application/v8-workflow';
import { localProfile } from '../../src/application/rules/local-profile';
import { basicItems } from '../../src/application/rules/basic-items';
import type { CoachProfile } from '../../src/domain/v8/contracts';
const profile:CoachProfile={goalText:'活动',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'每次20分钟',place:'home',equipment:['none'],adultConfirmed:true,cautions:[],confirmedAt:'2026-10-10T00:00:00Z'};
describe('local basic plan',()=>{
 it.each([15,20,30,120])('respects %s minute capacity with four real movements',minutes=>{const p=basicProposal({...profile,sessionMinutes:minutes})!;expect(p.templates).toHaveLength(2);for(const t of p.templates){expect(t.items.length).toBeGreaterThanOrEqual(4);expect(t.estimatedMinutes).toBeLessThanOrEqual(minutes);}expect(p.sessionMinutes).toBe(minutes);});
 it('keeps short words and maps ranges to smallest legal slot',()=>{const a={goalText:'活动',scheduleOriginalText:'每周2次，每次30–45分钟',placeEquipmentText:'在家',adultConfirmed:true,cautions:[]};expect(localProfile(a).sessionMinutes).toBe(30);expect(localProfile({...a,scheduleOriginalText:'每次20分钟'}).sessionMinutes).toBe(20);expect(()=>localProfile({...a,placeEquipmentText:'待定'})).toThrow();});
 it('does not generate for minors',()=>expect(basicProposal({...profile,adultConfirmed:false})).toBeUndefined());
 it.each(['knee','back','shoulder','wrist'] as const)('keeps an adapted draft for %s',area=>{const p=basicProposal({...profile,cautions:[area]})!;expect(p).toBeDefined();expect(Array.isArray(p.templates)).toBe(true);expect(p.reasons[1]).toContain('排除');});
 it('keeps an empty unsavable draft instead of guessing for unspecified limitations',()=>{const p=basicProposal({...profile,cautions:['other']})!;expect(p.templates).toEqual([]);expect(p.reasons[2]).toContain('已保留');});
 it('uses only confirmed equipment and excludes loaded pulling with back limitations',()=>{const body=basicItems(profile,1).items;expect(body.every(i=>i.equipment==='none')).toBe(true);const weighted=basicItems({...profile,equipment:['哑铃']},1).items;expect(weighted.some(i=>i.equipment==='dumbbell')).toBe(true);expect(basicItems({...profile,equipment:['哑铃'],cautions:['back']},1).items.every(i=>i.equipment!=='dumbbell'||i.exerciseId==='189798ab-984f-52b5-86aa-be66ed00289a')).toBe(true);});
});
