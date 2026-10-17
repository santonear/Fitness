import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import {Rules} from '../../../src/engine/data';
import {prescribe,type Template} from '../../../src/engine/dose';
import {runGates} from '../../../src/engine/gates';
import {foldGeneratedBodyweightWarmup,realizeBodyweightWarmup,sourceWarmupRamps} from '../../../src/engine/source-warmup';
import {toEngineProfile} from '../../../src/application/engine-profile';
import {SourceWarmupSteps} from '../../../src/ui/pages/training/SourceWarmupSteps';
vi.mock('../../../src/application/engine-profile',()=>({toEngineProfile:vi.fn()}));
vi.mock('../../../src/ui/mainline/context',()=>({useMainline:()=>({locale:'zh',data:{state:{coachProfile:{}},profile:{timeZone:'Asia/Shanghai',bodyDetails:{values:{}}},workouts:[]}})}));
const r=new Rules(),p=baseProfile({goal:'mobility',trainingAgeWeeks:52,sessionMinutes:30}),g=runGates(p,r);
function fixture(){const main=prescribe(r.data.exercises.find(e=>e.slug==='bodyweight-squat')!,p,r,g.restrictions,'main',3);main.target={metricType:'reps',reps:8};main.prescription!.sourcePosition='display-day-M1-main_1';main.prescription!.warmupSeconds=26;const warm=prescribe(r.data.exercises.find(e=>e.slug==='chair-pose')!,p,r,g.restrictions,'warmup',1);warm.prescription!.sourcePosition='display-day-WU3';return {id:'display-day',name:'source',estimatedMinutes:30,items:[warm,main]} as Template;}
it('hides duplicate half-repetition guidance when the exact source warmup is already an actual item',()=>{
 vi.mocked(toEngineProfile).mockReturnValue(p);const before=fixture();expect(renderToStaticMarkup(createElement(SourceWarmupSteps,{template:before,itemIndex:1}))).toContain('<ol>');const realized=realizeBodyweightWarmup(before,p,r);realized.items[1].prescription!.warmupSeconds=26;expect(renderToStaticMarkup(createElement(SourceWarmupSteps,{template:realized,itemIndex:1}))).toBe('');
});
it('retains existing loaded-ramp guidance without claiming that branch has been realized',()=>{
 const profile=baseProfile({...p,equipment:['none','dumbbell']});vi.mocked(toEngineProfile).mockReturnValue(profile);const e=r.data.exercises.find(e=>e.modality==='strength'&&e.metricType==='reps_load'&&e.equipment_required.includes('dumbbell')&&e.time.setup_s===r.get('duration.transition.setup').setup_s_defaults.dumbbell_kettlebell_band)!,main=prescribe(e,profile,r,runGates(profile,r).restrictions,'main',3);main.target={metricType:'reps_load',reps:8,loadGrams:10000};const t:Template={id:'loaded-display',name:'loaded',estimatedMinutes:30,items:[main]},ramp=sourceWarmupRamps(t,profile,r)[0];expect(ramp.kind).toBe('first_loaded_compound');main.prescription!.warmupSeconds=ramp.seconds;const html=renderToStaticMarkup(createElement(SourceWarmupSteps,{template:t,itemIndex:0}));expect(html).toContain('<ol>');expect(html.match(/<li>/g)).toHaveLength(r.get('session.warmup.ramp_sets').first_loaded_compound.scheme.length);
});

it('shows the actual four-repetition guidance once when a generated placeholder is folded into the existing main',()=>{
 vi.mocked(toEngineProfile).mockReturnValue(p);const out=foldGeneratedBodyweightWarmup(fixture(),p,r);expect(out.items).toHaveLength(1);const html=renderToStaticMarkup(createElement(SourceWarmupSteps,{template:out,itemIndex:0}));expect(html).toContain('<ol>');expect(html.match(/<li>/g)).toHaveLength(1);expect(html).toContain('4 ');
});