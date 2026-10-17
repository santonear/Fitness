import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {Rules} from '../../src/engine/data';
it('keeps the source equipment-free chest hold available without inventing a wall requirement',()=>{
 const source=JSON.parse(readFileSync('src/catalog/generated/details.json','utf8')).entries.find((e:{slug:string})=>e.slug==='doorway-chest-stretch');
 expect(source.equipment).toBe('none');
 expect(source.steps).toEqual(['Stand tall and raise your arms into a goalpost position.','Bend your elbows ninety degrees, forearms vertical.','Draw your elbows back and squeeze your shoulder blades.','Hold for 20 to 30 seconds, breathing steadily.']);
 const actual=new Rules().data.exercises.find(e=>e.slug===source.slug)!;
 expect(actual.equipment_required).toEqual(['none']);
 expect(actual.position).toEqual(['standing']);
 expect(actual.joint_load.shoulder).toBe(1);
 expect(actual.stretch_targets).toEqual(['chest']);
});
