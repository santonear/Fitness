import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {PrescriptionDetails} from '../../../src/ui/pages/training/PrescriptionDetails';
import {Rules} from '../../../src/engine/data';
import {prescribe} from '../../../src/engine/dose';
import {runGates} from '../../../src/engine/gates';
import {fixtureProfile} from './fixtures';
const r=new Rules(),p={...fixtureProfile,level:'intermediate' as const,trainingAgeWeeks:30},g=runGates(p,r),e=r.data.exercises.find(e=>e.slug==='one-arm-dumbbell-swing')!;
it.each(['zh','en'] as const)('renders the approved speed cue once and a relative load, not a guessed kilogram value (%s)',locale=>{
 const item=prescribe(e,p,r,g.restrictions),html=renderToStaticMarkup(createElement(PrescriptionDetails,{prescription:item.prescription,locale}));
 const cue=r.text('dose.power.copy.speed_stop')[locale];expect(html.split(cue)).toHaveLength(2);expect(html).toContain(item.prescription!.loadDescription![locale]);expect(item.target).not.toHaveProperty('loadGrams');
});
