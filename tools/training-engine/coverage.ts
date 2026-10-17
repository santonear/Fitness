import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {compileAnnotations} from './compile-annotations.ts';
import {compileRules} from './compile-rules.ts';

type RecordValue=Record<string,unknown>;
function get(object:unknown,path:string):unknown {return path.split('.').reduce((value,key)=>value&&typeof value==='object'?(value as RecordValue)[key]:undefined,object);}
// This interpreter evaluates the published exclusion predicate grammar only; no eval or generated code.
export function matches(condition:unknown,exercise:unknown,user:RecordValue):boolean {
 if(!condition||typeof condition!=='object')return false;
 const c=condition as RecordValue;
 if(Array.isArray(c.any))return c.any.some(item=>matches(item,exercise,user));
 if(Array.isArray(c.all))return c.all.every(item=>matches(item,exercise,user));
 if(c.not)return !matches(c.not,exercise,user);
 for(const [predicate,field] of [['flag','flags'],['position','position'],['use','use']])if(c[predicate]){
  const wanted=Array.isArray(c[predicate])?c[predicate] as unknown[]:[c[predicate]];
  const actual=get(exercise,field) as unknown[];
  return wanted.some(value=>actual?.includes(value));
 }
 const value=typeof c.field==='string'?get(exercise,c.field):typeof c.user==='string'?get(user,c.user):undefined;
 if('eq'in c)return value===c.eq;if('ne'in c)return value!==c.ne;if('is'in c)return value===c.is;
 if('gte'in c)return typeof value==='number'&&value>=Number(c.gte);if('gt'in c)return typeof value==='number'&&value>Number(c.gt);
 if('lte'in c)return typeof value==='number'&&value<=Number(c.lte);if('lt'in c)return typeof value==='number'&&value<Number(c.lt);
 if(Array.isArray(c.in))return c.in.includes(value);if(Array.isArray(c.not_in))return !c.not_in.includes(value);
 if('contains'in c)return Array.isArray(value)&&value.includes(c.contains);
 if(Array.isArray(c.contains_any))return Array.isArray(value)&&c.contains_any.some(item=>value.includes(item));
 return false;
}
export function equipmentSatisfied(exercise:{equipment_required:string[];equipment_alternatives:Record<string,string[]|undefined>},available:ReadonlySet<string>) {
 return exercise.equipment_required.every(required=>required==='none'||required==='yoga-mat-optional'||available.has(required)||(exercise.equipment_alternatives[required]??[]).some(alternative=>available.has(alternative)));
}

export async function coverage(){
 const data=await compileAnnotations(),{rules}=await compileRules();
 const config=JSON.parse(await readFile('data/training-engine/coverage-contract.json','utf8'));
 const rule=(id:string)=>{const found=rules.find(row=>row.id===id);if(!found)throw Error('Missing coverage rule '+id);return found.value as RecordValue;};
 if(JSON.stringify(config.carryEquivalentPatterns)!==JSON.stringify(rule(config.carryEquivalentSourceRuleId).patterns))throw Error('Carry equivalence must exactly match its authored source rule patterns');
 const pregnancyRules=rules.filter(row=>row.id.startsWith('pregnancy.exclude.')).map(row=>row.value as RecordValue);
 const failures:{scenario:string;pattern:string;restriction:string;count:number}[]=[],rawFailures:typeof failures=[];
 const reports=[];
 for(const scenario of config.scenarios){
  const available=new Set<string>(scenario.equipment);
  const rows=[];
  for(const pattern of config.patterns){
   const counts:Record<string,number>={},gateCounts:Record<string,number>={};
   for(const restriction of config.restrictions){
    const candidates=data.exercises.filter(exercise=>{
     if(exercise.modality==='mobility'||exercise.difficulty>(restriction==='beginner'?config.beginnerDifficultyMaximum:config.difficultyMaximum)||!equipmentSatisfied(exercise,available))return false;
     if(['knee','back','shoulder','wrist'].includes(restriction)){
      if(exercise.excluded_cautions?.includes(restriction))return false;
      const value=rule('caution.'+restriction+'.filter');
      if(matches((value.level_1 as RecordValue).exclude_if,exercise,{equipment:[...available]}))return false;
     }
     if(restriction==='quiet'&&exercise.noise>0)return false;
     if(restriction==='pregnancy'&&pregnancyRules.some(value=>(!value.when||matches(value.when,exercise,{gestation_week:config.pregnancyWeek}))&&matches(value.exclude_if,exercise,{gestation_week:config.pregnancyWeek})))return false;
     return true;
    });
    counts[restriction]=candidates.filter(exercise=>exercise.primary_pattern===pattern).length;
    gateCounts[restriction]=pattern==='carry'&&config.carryEquivalentAuthorized?candidates.filter(exercise=>config.carryEquivalentPatterns.includes(exercise.primary_pattern)).length:counts[restriction];
    const exempt=config.allowedZero.some((exception:{pattern:string;restriction:string})=>exception.pattern===pattern&&exception.restriction===restriction);
    if(counts[restriction]<config.minimumPerCell&&!exempt)rawFailures.push({scenario:scenario.id,pattern,restriction,count:counts[restriction]});
    if(gateCounts[restriction]<config.minimumPerCell&&!exempt)failures.push({scenario:scenario.id,pattern,restriction,count:gateCounts[restriction]});
   }
   rows.push({pattern,counts,gateCounts});
  }
  const equivalent=rows.find(row=>row.pattern==='carry')!.gateCounts;
  reports.push({scenario,rows,carryOrGround:equivalent});
 }
 const headings:Record<string,string>={unrestricted:'无限制',knee:'膝注意',back:'腰注意',shoulder:'肩注意',wrist:'腕注意',quiet:'安静',pregnancy:'孕中期20周',beginner:'新手难度≤2'};
 let markdown='# 训练引擎动作覆盖报告\n\n由 `node tools/training-engine/coverage.ts` 生成。逐项使用完整器械及替代品、主要动作模式和机器规则排除条件。没有自动假定墙、椅子、桌子、门扣或固定点可用。瑜伽垫为可选项。\n\n';
 markdown+=`来源动作 ${data.counts.repdb}；本地动作 ${data.counts.native}；原创补充 ${data.counts.custom}；总计 ${data.counts.total}。规则版本 ${data.rulesVersion}。\n\n`;
 for(const report of reports){markdown+=`## ${report.scenario.label}\n\n器械：${report.scenario.equipment.join('、')}。下表保留主要模式原始数量。\n\n| 模式 | ${config.restrictions.map((r:string)=>headings[r]).join(' | ')} |\n|---|${config.restrictions.map(()=>'---').join('|')}|\n`;for(const row of report.rows)markdown+=`| ${row.pattern} | ${config.restrictions.map((restriction:string)=>row.counts[restriction]).join(' | ')} |\n`;markdown+=`\n已批准 carry_or_ground 闸门数量：${JSON.stringify(report.carryOrGround)}。只合计主要模式 carry 与 locomotion_ground，不计抗侧屈等其他模式。\n\n`;}
 markdown+=`## 闸门结果\n\n原始计数低于 ${config.minimumPerCell} 的非豁免格子 ${rawFailures.length} 个。按用户批准的 carry_or_ground 等效口径，闸门 ${failures.length?'未通过':'通过'}；不足格子 ${failures.length} 个。其余模式仍严格使用原始数量。肩注意的过头推按原任务豁免。\n\n`;
 if(failures.length)markdown+='| 场景 | 模式 | 限制 | 数量 |\n|---|---|---|---|\n'+failures.map(row=>`| ${row.scenario} | ${row.pattern} | ${row.restriction} | ${row.count} |`).join('\n')+'\n';
 await mkdir('docs/training-engine',{recursive:true});await writeFile('docs/training-engine/coverage-report.md',markdown.trimEnd()+'\n');
 await writeFile('src/engine/generated/coverage.json',JSON.stringify({rulesVersion:data.rulesVersion,reports,rawFailures,failures,carryEquivalentAuthorized:config.carryEquivalentAuthorized}));
 console.log(`Coverage: ${reports.length} equipment scenarios × ${config.restrictions.length} restrictions; raw failures ${rawFailures.length}; gate failures ${failures.length}; carry equivalent authorized: ${config.carryEquivalentAuthorized}.`);
 return failures;
}
if(process.argv[1]&&import.meta.url===new URL('file:///'+process.argv[1].replaceAll('\\','/')).href){const failures=await coverage();if(failures.length)process.exitCode=1;}
