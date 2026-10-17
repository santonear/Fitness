import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Rules} from '../../../src/engine/data';
import {runGates} from '../../../src/engine/gates';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import {cmrAnswerSummary,CmrSymptomsQuestions} from '../../../src/ui/pages/settings/CmrSymptomsQuestions';
const r=new Rules(),keys=r.get('safety.screen.cmr_symptoms').symptoms as string[];
it('all nine source answers are required, with no defaults for legacy profiles',()=>{const p=baseProfile();expect(keys).toHaveLength(9);expect(runGates(p,r).status).not.toBe('blocked');delete p.screening.cmrSymptoms;expect(runGates(p,r).status).toBe('blocked');expect(p.screening.cmrSymptoms).toBeUndefined();expect(cmrAnswerSummary({})).toEqual({complete:false,symptoms:false});});
it('every individual source positive overrides a false legacy aggregate and vigorous clearance',()=>{for(const key of keys){const p=baseProfile();p.screening.cmrSymptoms![key]=true;p.screening.symptoms=false;p.screening.clearance={date:p.screening.completedAt!,intensity:'vigorous'};const gate=runGates(p,r);expect(gate.status,key).toBe('blocked');expect(gate.reasons.some(v=>v.ruleId==='safety.clearance.hard_stop'),key).toBe(true);}});
it('every missing answer remains incomplete, and an old positive is never silently cleared',()=>{for(const key of keys){const p=baseProfile();delete p.screening.cmrSymptoms![key];expect(runGates(p,r).status,key).toBe('blocked');expect(cmrAnswerSummary(p.screening.cmrSymptoms!).complete,key).toBe(false);}const p=baseProfile();p.screening.symptoms=true;expect(runGates(p,r).status).toBe('blocked');});
it('a complete explicit all-no set is complete; partial yes remains symptomatic',()=>{const answers=Object.fromEntries(keys.map(key=>[key,false]));expect(cmrAnswerSummary(answers)).toEqual({complete:true,symptoms:false});expect(cmrAnswerSummary({[keys[0]]:true})).toEqual({complete:false,symptoms:true});});
it('renders nine separate source questions with unknown selected and source bilingual copy',()=>{for(const locale of ['zh','en'] as const){const html=renderToStaticMarkup(createElement(CmrSymptomsQuestions,{answers:{},onChange:()=>{},locale}));expect(html.match(/<select/g)).toHaveLength(9);expect(html.match(/value="" selected=""/g)).toHaveLength(9);for(const key of keys)expect(html).toContain(r.data.copy[`safety.copy.cmr_${key}`][locale]);}});

