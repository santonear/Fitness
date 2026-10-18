import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
export default function setup() {
 const folder=resolve('src/themes/followup-test');
 if(existsSync(folder)) throw new Error('Temporary fifth theme already exists; refuse to overwrite');
 mkdirSync(folder);
 writeFileSync(`${folder}/manifest.ts`, `import pop from '../pop/manifest'; export default {...pop,id:'followup-test',name:{zh:'测试第五主题',en:'Test fifth theme'},themeColor:'#f6f7f3'};`);
 writeFileSync(`${folder}/tokens.css`,readFileSync('src/themes/pop/tokens.css','utf8').replaceAll('data-theme="pop"','data-theme="followup-test"'));
 return ()=>rmSync(folder,{recursive:true});
}
