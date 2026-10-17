import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {describe,it,expect} from 'vitest';
import {DATA,Rules,requiresAlternatingDay,adjacentTrainingDays,restrictedAdjacentIds} from '../../../src/engine/data';
import type {Exercise,Rule} from '../../../src/engine/data';
import type {PlannedItem} from '../../../src/domain/v8/contracts';
import type {Weekday} from '../../../src/engine/contracts';
const source=parse(readFileSync('data/training-engine/rules/rules-ch06.yaml','utf8')) as Rule[];
const rule=source.find(r=>r.id==='variety.no_repeat')!;
const original=new Rules(),base=original.data.exercises[0];
function fixture(modality:string,facts:Partial<Exercise>={}) {const e={...base,id:'test',modality,...facts};return new Rules({...DATA,rules:DATA.rules.map(r=>r.id===rule.id?rule:r),exercises:[e]});}
function item(rpe?:[number,number],hiit=false):PlannedItem{return {exerciseId:'test',equipment:'none',sets:1,target:{metricType:'duration',durationSeconds:30},prescription:{pattern:'carry',block:'conditioning',rir:[4,4],restSeconds:0,...(rpe?{targetRpe:rpe}:{}),...(hiit?{trainingStyle:'hiit' as const}:{})}};}
describe('source adjacent-day scope',()=>{
 it.each(['strength','power','plyometric'])('restricts %s even with a low prescribed RPE',modality=>expect(requiresAlternatingDay(item([2,3]),fixture(modality))).toBe(true));
 it('exempts mobility while unknown modality and exercise facts remain restricted',()=>{expect(requiresAlternatingDay(item(),fixture('mobility'))).toBe(false);expect(requiresAlternatingDay(item(),fixture('unknown'))).toBe(true);expect(requiresAlternatingDay({...item(),exerciseId:'missing'},fixture('mobility'))).toBe(true);});
 it('only verified pure static balance isometric facts exempt, never absent kilograms',()=>{const facts={primary_pattern:'balance' as const,nsca_class:'none',balance:{base:'wide' as const,mode:'static' as const,hand_support:true}};expect(requiresAlternatingDay(item(),fixture('isometric',facts))).toBe(false);for(const changed of [{balance:undefined},{nsca_class:'compound'},{primary_pattern:'anti_extension' as const},{balance:{...facts.balance,mode:'dynamic' as const}}])expect(requiresAlternatingDay(item(),fixture('isometric',{...facts,...changed}))).toBe(true);});
 it('exempts only explicit light to moderate cardio and refuses HIIT, missing or malformed RPE',()=>{const r=fixture('cardio'),cap=r.get('aerobic.intensity.rpe_scale').moderate[1];expect(requiresAlternatingDay(item([2,cap]),r)).toBe(false);for(const value of [item(),item([cap,cap+1]),item([5,4]),item([NaN,4]),item([2,3],true)])expect(requiresAlternatingDay(value,r)).toBe(true);expect(requiresAlternatingDay(item([2,3]),fixture('cardio',{flags:['hiit']}))).toBe(true);});
 it('reads the RPE threshold from referenced source rather than a copied constant',()=>{const r=fixture('cardio'),changed=new Rules({...r.data,rules:r.data.rules.map(v=>v.id==='aerobic.intensity.rpe_scale'?{...v,value:{...v.value,moderate:[3,4]}}:v)});expect(requiresAlternatingDay(item([4,5]),r)).toBe(false);expect(requiresAlternatingDay(item([4,5]),changed)).toBe(true);});
 it('recognizes only genuine weekday neighbors including Sunday to Monday symmetrically',()=>{const days:Weekday[]=['mon','tue','wed','thu','fri','sat','sun'];for(let a=0;a<7;a++)for(let b=0;b<7;b++)expect(adjacentTrainingDays(days[a],days[b])).toBe(a!==b&&([1,6].includes(Math.abs(a-b))));});
 it('restricts only adjacent dated templates and never invents dates from order',()=>{const r=fixture('strength'),templates=[{weekday:'sun' as const,items:[item()]},{weekday:'wed' as const,items:[{...item(),exerciseId:'distant'}]},{items:[{...item(),exerciseId:'undated'}]}];expect([...restrictedAdjacentIds(templates,'mon',r)]).toEqual(['test']);expect([...restrictedAdjacentIds(templates,undefined,r)]).toEqual([]);expect([...restrictedAdjacentIds([{weekday:'sun',items:[item([2,3])]}],'mon',fixture('cardio'))]).toEqual([]);});
});
