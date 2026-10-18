import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import runtime from '../../src/engine/generated/exercise-index.json';
it('hydrates body regions only from explicit existing catalog metadata',()=>{
 const registry=JSON.parse(readFileSync('src/catalog/generated/registry.json','utf8')) as {id:string;bodyPart?:string}[];
 const custom=JSON.parse(readFileSync('src/catalog/custom-exercises.json','utf8')) as {id:string;bodyPart?:string}[];
 for(const exercise of runtime.exercises){const source=registry.find(e=>e.id===exercise.id)??custom.find(e=>e.id===exercise.id);if(source?.bodyPart)expect((exercise as {bodyPart?:string}).bodyPart).toBe(source.bodyPart);else expect(exercise).not.toHaveProperty('bodyPart');}
 for(const slug of ['custom-standing-self-row-hold','custom-self-resisted-pulldown-hold','pilates-saw'])expect((runtime.exercises.find(e=>e.slug===slug) as {bodyPart?:string}).bodyPart).toBe('back');
});
