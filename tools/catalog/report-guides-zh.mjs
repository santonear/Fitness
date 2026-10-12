import {readFile,writeFile} from 'node:fs/promises';
import {chineseGuides} from './guides-zh.mjs';

const registry=JSON.parse(await readFile('src/catalog/generated/registry.json','utf8'));
const known=new Set(registry.map(entry=>entry.slug));
const unknown=Object.keys(chineseGuides).filter(slug=>!known.has(slug));
if(unknown.length)throw Error('Unknown guide slugs: '+unknown.join(', '));
const pending=registry.filter(entry=>!chineseGuides[entry.slug]).map(entry=>`${entry.slug}\t${entry.bodyPart}`);
const report=`# RepDB 中文指导待补清单\n# 已有 ${Object.keys(chineseGuides).length} / ${registry.length}，待补 ${pending.length}\n# slug<TAB>bodyPart\n${pending.join('\n')}\n`;
if(process.argv.includes('--write'))await writeFile('tools/catalog/pending-guides-zh.txt',report);
else process.stdout.write(report);
