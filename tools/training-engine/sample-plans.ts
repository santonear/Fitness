import {writeFile} from 'node:fs/promises';
import {sampledProfiles,TRAINING_ENGINE_SEED} from '../eval/training-engine-profiles';
import {generatePlan} from '../../src/engine';
import {Rules,hash,age} from '../../src/engine/data';
import {scorePlan} from '../../src/engine/score';
import {estimateSeconds} from '../../src/engine/fit';
const rules=new Rules();
const profiles=sampledProfiles(80);
const rows=profiles.map((profile,index)=>{const plan=generatePlan(profile),score=scorePlan(plan,profile,rules);return {profile,index,plan,score};}).sort((a,b)=>a.score.quality-b.score.quality||a.index-b.index);
const safe=(value:unknown)=>String(value??'未填写').replaceAll('|','／').replaceAll('\n',' ');
const out=['# 固定画像训练计划抽查样本','',`种子：${TRAINING_ENGINE_SEED}；规则：${rules.data.rulesVersion}；画像及输出指纹：${hash(rows)}。`,'','从完整80画像（包含健康阻断及受限结果）按实际质量分升序、原画像索引为同分次序，选取排名 round(i×79/11)，i=0…11。分数不是安全认证；阻断样本不冒充可执行计划。',''];
for(let i=0;i<12;i++){
 const rank=Math.round(i*79/11),{profile:p,index,plan,score}=rows[rank];
 out.push(`## 样本 ${i+1}：画像 ${index}（排序 ${rank+1}/80）`,'',`- 画像：${age(p)??'年龄未知'}岁；${p.level}；目标 ${p.goal}；每周 ${p.daysPerWeek} 天，每次 ${p.sessionMinutes} 分钟；场地 ${p.place}；空间 ${p.constraints.space}；人群 ${p.population.kind}。`,`- 器械：${p.equipment.join('、')||'无'}；注意部位：${p.cautions.join('、')||'无已登记项'}。`,`- 完整合成画像：${safe(JSON.stringify(p))}`,`- 质量分：${score.quality.toFixed(8)}；状态：${plan.quality?.status??'未标注'}；安全门：${plan.gates.map(g=>`${g.ruleId}=${g.status}`).join('；')||'无阻断'}。`,`- 每周结构：${plan.templates.map((t,n)=>`${n+1}. ${t.name}（目标${t.targetMinutes??'不定'}分钟，实际${(estimateSeconds(t,rules)/60).toFixed(2)}分钟）`).join('；')||'没有可执行训练单'}。`,'','失分最多的3条规则：','');
 for(const v of [...score.perRule].sort((a,b)=>b.weight*(1-b.satisfaction)-a.weight*(1-a.satisfaction)||a.id.localeCompare(b.id)).slice(0,3))out.push(`- ${v.id}：满足度 ${v.satisfaction.toFixed(6)}，权重 ${v.weight}，加权失分 ${(v.weight*(1-v.satisfaction)).toFixed(6)}。`);
 if(!score.perRule.length)out.push('- 不适用：此样本没有可计分规则，不将其视为质量通过。');
 out.push('','用户提示：','',...plan.notices.map(n=>`- ${safe(n.message.zh)}`));if(!plan.notices.length)out.push('- 无。');
 for(const [n,t]of plan.templates.entries()){
  out.push('',`### 第 ${n+1} 次：${safe(t.name)}`,'','| 动作 | 阶段 | 组数 | 每组次数／时长 | 休息 | 专项热身 |','|---|---|---:|---|---|---|');
  for(const item of t.items){const e=rules.byExercise.get(item.exerciseId),target=item.target;out.push(`| ${safe(e?.name.zh??item.exerciseId)} (${item.exerciseId}) | ${item.prescription?.block??'未标注'} | ${item.sets} | ${'reps'in target?`${target.reps}次`:`${target.durationSeconds}秒`}${'loadGrams'in target?`，${target.loadGrams}克`:''}${'distanceMeters'in target?`，${target.distanceMeters}米`:''} | ${item.prescription?.restSeconds??'按来源默认'} | ${item.prescription?.warmupSeconds??0}秒 |`);}
 }
 out.push('');
}
await writeFile('docs/training-engine/sample-plans.md',out.join('\n')+'\n');
console.log(`Exported 12/80 samples; ranks ${Array.from({length:12},(_,i)=>Math.round(i*79/11)+1).join(', ')}.`);
