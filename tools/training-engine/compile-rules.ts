import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';
import {z} from 'zod';
import {patternSchema} from '../../src/engine/contracts/profile.ts';

const localized = z.union([z.string(), z.array(z.string()), z.record(z.string(), z.unknown())]);
export const ruleSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+(?:\.[a-z0-9_]+){1,3}$/), chapter: z.number().int().min(0).max(13),
  type: z.enum(['limit','default','gate','copy','trigger','formula','template','substitute','exclude']),
  evidence: z.enum(['A','B','C']), sources: z.array(z.string().min(1)).min(1),
  value: z.unknown().optional(), applies: z.record(z.string(),z.unknown()).optional(),
  zh: localized.optional(), en: localized.optional(), note: z.string().optional(),
  unverified: z.array(z.string()).optional(), professional_review: z.boolean().optional(),deferred:z.boolean().optional(),
});
type Rule = z.infer<typeof ruleSchema>;
type Copy = {zh:string;en:string;sourceRuleId:string;path:string};
const severitySchema=z.enum(['hard','target','advice','mechanic','copy','meta']);
const severityRow=z.strictObject({id:z.string(),type:ruleSchema.shape.type,severity:severitySchema,weight:z.number().finite().positive().optional()});
const severityDocument=z.strictObject({version:z.string().min(1),definitions:z.record(severitySchema,z.string()),overrides:z.record(z.string(),z.unknown()),rules:z.array(severityRow)});
export function mergeRuleSeverity(rules:Rule[],input:unknown){
 const document=severityDocument.parse(input),rows=new Map<string,z.infer<typeof severityRow>>();
 for(const row of document.rules){if(rows.has(row.id))throw Error('Duplicate severity ID: '+row.id);rows.set(row.id,row);}
 const ids=new Set(rules.map(rule=>rule.id));for(const id of rows.keys())if(!ids.has(id))throw Error('Unknown severity ID: '+id);
 return rules.map(rule=>{
  const row=rows.get(rule.id);if(!row)throw Error('Missing severity ID: '+rule.id);
  if(row.type!==rule.type)throw Error('Severity type mismatch: '+rule.id);
  if(row.severity==='target'&&row.weight===undefined||row.severity!=='target'&&row.weight!==undefined)throw Error('Invalid severity weight: '+rule.id);
  return {...rule,severity:row.severity,...(row.weight!==undefined?{weight:row.weight}:{})};
 });
}

export async function writeJson(path:string, value:unknown) {
  const bytes = JSON.stringify(value);
  try {if (await readFile(path,'utf8') === bytes) return;} catch (e) {if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;}
  await writeFile(path,bytes);
}

// References include published families and value paths, not just exact rule IDs.
export function resolveRuleReference(reference:string, rules:Rule[]) {
  const exact = rules.find(rule => rule.id === reference);
  if (exact) return true;
  if (rules.some(rule => rule.id.startsWith(reference+'.'))) return true;
  for (const rule of rules) if (reference.startsWith(rule.id+'.')) {
    let value:unknown = rule.value;
    for (const segment of reference.slice(rule.id.length+1).split('.')) {
      if (!value || typeof value !== 'object' || !(segment in value)) {value=undefined;break;}
      value=(value as Record<string,unknown>)[segment];
    }
    if (value !== undefined) return true;
  }
  return false;
}

export function extractCopy(rules:Rule[]) {
  const copy:Record<string,Copy>={};
  function visit(node:unknown, rule:Rule, path:string) {
    if (!node || typeof node !== 'object') return;
    const obj=node as Record<string,unknown>;
    if (typeof obj.zh==='string' && typeof obj.en==='string') {
      const key=path ? rule.id+'.'+path.replace(/^value\.?/,'') : rule.id;
      copy[key]={zh:obj.zh,en:obj.en,sourceRuleId:rule.id,path};
    } else if (obj.zh !== undefined && obj.en !== undefined) {
      function pair(zh:unknown,en:unknown,suffix:string) {
        if(typeof zh==='string'&&typeof en==='string') copy[rule.id+(suffix?'.'+suffix:'')]={zh,en,sourceRuleId:rule.id,path:(path?path+'.':'')+'zh'+(suffix?'.'+suffix:'')};
        else if(zh&&en&&typeof zh==='object'&&typeof en==='object') for(const key of Object.keys(zh)) pair((zh as Record<string,unknown>)[key],(en as Record<string,unknown>)[key],suffix?suffix+'.'+key:key);
      }
      pair(obj.zh,obj.en,'');
    }
    // Some published checklists use sibling *_zh / *_en arrays.
    for (const key of Object.keys(obj)) if(key.endsWith('_zh')&&Array.isArray(obj[key])&&Array.isArray(obj[key.slice(0,-3)+'_en'])) {
      const en=obj[key.slice(0,-3)+'_en'] as unknown[];
      (obj[key] as unknown[]).forEach((zh,index)=>{if(typeof zh==='string'&&typeof en[index]==='string') copy[rule.id+'.'+key.slice(0,-3)+'.'+index]={zh,en:en[index] as string,sourceRuleId:rule.id,path:(path?path+'.':'')+key+'.'+index};});
    }
    for(const [key,value] of Object.entries(obj)) if(key!=='zh'&&key!=='en') visit(value,rule,path?path+'.'+key:key);
  }
  for(const rule of rules) visit(rule,rule,'');
  return copy;
}

export async function compileRules(root=process.cwd()) {
  const directory=resolve(root,'data/training-engine/rules');
  const files=(await readdir(directory)).filter(file=>file.endsWith('.yaml')&&file!=='severity.yaml').sort();
  const sourceRules:Rule[]=[];
  for(const file of files) sourceRules.push(...z.array(ruleSchema).parse(parse(await readFile(resolve(directory,file),'utf8'))));
  if(new Set(sourceRules.map(rule=>rule.id)).size!==sourceRules.length) throw Error('Duplicate rule ID');
  const rules=mergeRuleSeverity(sourceRules,parse(await readFile(resolve(directory,'severity.yaml'),'utf8')));
  const copy=extractCopy(rules);
  const referenceKeys=/^(.*_ref|ref|show_copy|unlock_via|skip_rule|companion_copy|other_sessions|start_from|leakage_route|then|respect|filters|must_pass|lists|also_apply|overridden_by|requires|route)$/;
  const predicateEnums:Record<string,readonly string[]>={
    primary_pattern:patternSchema.options,modality:['strength','isometric','plyometric','cardio','mobility','power'],
    nsca_class:['power','compound','isolation','none'],laterality:['bilateral','unilateral','alternating'],space:['mat','small','medium','large'],
  };
  function validate(node:unknown) {
    if(!node||typeof node!=='object')return;
    const object=node as Record<string,unknown>;
    if(typeof object.field==='string'&&predicateEnums[object.field])for(const operator of ['eq','ne','in','not_in']){
      const expected=object[operator];
      if(expected!==undefined)for(const value of (Array.isArray(expected)?expected:[expected]))if(typeof value!=='string'||!predicateEnums[object.field].includes(value))throw Error('Invalid '+object.field+' enum: '+String(value));
    }
    for(const [key,value] of Object.entries(node)) {
      if(referenceKeys.test(key)) for(const reference of (Array.isArray(value)?value:[value])) {
        if(typeof reference==='string'&&/^[a-z_]+(?:\.[a-z0-9_]+)+$/.test(reference)&&!resolveRuleReference(reference,rules)&&!copy[reference])throw Error('Unresolved rule reference: '+reference);
      }
      if(typeof value==='string'){
        const actionReference=value.match(/(?:show_copy_|show_|check_|run_)((?:[a-z0-9_]+\.)+[a-z0-9_]+)$/)?.[1];
        if(actionReference&&!resolveRuleReference(actionReference,rules)&&!copy[actionReference])throw Error('Unresolved action rule reference: '+actionReference);
      }
      validate(value);
    }
  }
  rules.forEach(validate);
  const rulesVersion=createHash('sha256').update(JSON.stringify(rules)).digest('hex');
  await mkdir(resolve(root,'src/engine/generated'),{recursive:true});
  await writeJson(resolve(root,'src/engine/generated/rules.json'),{rulesVersion,rules,copy});
  // Keep the full auditable rules above. Runtime keeps every behavior value and every
  // localized copy leaf, while omitting source/review metadata and duplicate top-level copy.
  const runtimeRules=rules.map(({note:_,evidence:__,sources:___,unverified:____,professional_review:_____,zh:______,en:_______,...rule})=>rule);
  await writeJson(resolve(root,'src/engine/generated/rules-runtime.json'),{rulesVersion,rules:runtimeRules,copy});
  console.log(`Training rules: ${rules.length}; copy leaves: ${Object.keys(copy).length}; version: ${rulesVersion.slice(0,12)}`);
  return {rulesVersion,rules,copy};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) await compileRules();
