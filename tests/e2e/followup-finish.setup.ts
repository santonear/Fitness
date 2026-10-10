import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
export default function setup() {
 const folder=resolve('src/themes/followup-test');
 if(existsSync(folder)) throw new Error('Temporary fifth theme already exists; refuse to overwrite');
 mkdirSync(folder);
 writeFileSync(`${folder}/manifest.ts`, `import qingci from '../qingci/manifest'; export default {...qingci,id:'followup-test',name:{zh:'测试第五主题',en:'Test fifth theme'},themeColor:'#f6f7f3'};`);
 writeFileSync(`${folder}/tokens.css`,readFileSync('src/themes/qingci/tokens.css','utf8').replaceAll('data-theme="qingci"','data-theme="followup-test"'));
 return ()=>rmSync(folder,{recursive:true});
}
