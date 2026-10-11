import type { CoachRequest, CoachResponse } from './contracts';
import type { CoachProfile } from '../domain/v8/contracts';
import { exercises } from '../catalog/exercises';
import { basicItems, discomfortReplacement, discomfortExample } from '../application/rules/basic-items';
import { estimatePlannedMinutes } from '../application/rules/duration-estimate';
import zh from '../i18n/features/coach/local.zh.json';
import en from '../i18n/features/coach/local.en.json';

export type LocalReply = { lines: string[]; review?: boolean; response?: CoachResponse; guideExerciseId?: string };
const fill = (s: string, values: Record<string,string|number>) => s.replace(/\{(\w+)\}/g, (_,key) => String(values[key] ?? ''));
/** Read-only local candidates. Saving still uses the normal explicit acceptance transaction. */
export function localCoachReply(message: string, request?: CoachRequest, profile?: CoachProfile, locale: 'zh'|'en' = request?.locale ?? 'zh', lockedItemIndexes?: readonly number[]): LocalReply {
  const copy = locale === 'en' ? en : zh;
  const identity = request && { requestId: request.requestId, restoreGeneration: request.restoreGeneration, mutationAllowed: false as const };
  if (/疼|痛|不适|不舒服|pain|hurt|discomfort/i.test(message)) {
    const lines = [...copy.pain, copy.safety];
    const areas: CoachProfile['cautions'] = [];
    for (const [pattern,area] of [[/膝|knee/i,'knee'],[/腰|背|back/i,'back'],[/肩|shoulder/i,'shoulder'],[/腕|wrist/i,'wrist']] as const) if (pattern.test(message)) areas.push(area);
    const cautions = [...new Set([...(profile?.cautions ?? []), ...areas])];
    // Unspecified or multiple painful areas are not enough for an exercise example.
    if (areas.length !== 1 || /其他|其它|全身|脖|颈|髋|脚|踝|肘|胸|other|neck|hip|ankle|foot|elbow|chest|all over/i.test(message)) return { lines };
    const example = discomfortExample(cautions);
    const mentionsMovement = exercises.some(exercise => [exercise.name.zh, exercise.name.en].some(name => message.toLowerCase().includes(name.toLowerCase())));
    if (example && !mentionsMovement) lines[3] += (locale === 'zh' ? '' : ' ') + fill(copy.example, { after: example.name[locale] });
    if (request?.task !== 'ADJUST_TODAY' || !profile) return { lines };
    // Never guess the painful movement or a new medical exclusion boundary.
    const named = request.template.items.filter(item => { const e = exercises.find(e => e.id === item.exerciseId); return e && [e.name.zh,e.name.en].some(name => message.toLowerCase().includes(name.toLowerCase())); });
    if (!areas.length || named.length !== 1 || request.workoutId && (!lockedItemIndexes || lockedItemIndexes.includes(request.template.items.indexOf(named[0])))) return { lines };
    const item = named[0], replacement = discomfortReplacement(item.exerciseId, { ...profile, cautions: [...new Set([...profile.cautions,...areas])] });
    if (!replacement) return { lines };
    const items = request.template.items.map(i => i === item ? { ...replacement, sets: Math.min(i.sets, replacement.sets) } : i);
    const template = { ...request.template, items, estimatedMinutes: estimatePlannedMinutes(items) };
    lines[3] = fill(copy.replacement, { before: exercises.find(e=>e.id===item.exerciseId)!.name[locale], after: exercises.find(e=>e.id===replacement.exerciseId)!.name[locale] });
    return { lines, response: { ...identity!, type:'today_adjustment', target:request.target, ...(request.workoutId ? {workoutId:request.workoutId} : {}), template, summary: lines.join('\n') } };
  }
  if (/时间不够|没时间|赶时间|短一点|15\s*(?:分钟|minutes?|mins?)|十五分钟|short|less time|not enough time/i.test(message) && request?.task === 'ADJUST_TODAY') {
    if (request.workoutId && !lockedItemIndexes) return { lines: [...copy.time.slice(0,2), fill(copy.time[2],{before:request.template.estimatedMinutes}),copy.noShort] };
    const keep = Math.max(3,...(lockedItemIndexes ?? []).map(index=>index+1));
    const items = request.template.items.slice(0,keep).map((item,index) => lockedItemIndexes?.includes(index) ? item : ({ ...item, sets: Math.min(2,item.sets) }));
    const template = { ...request.template, items, estimatedMinutes: estimatePlannedMinutes(items) };
    const lines = copy.time.map(line => fill(line,{before:request.template.estimatedMinutes,after:template.estimatedMinutes}));
    if (template.estimatedMinutes >= request.template.estimatedMinutes) return { lines:[...lines.slice(0,3),copy.noShort] };
    return { lines, response:{...identity!,type:'today_adjustment',target:request.target,...(request.workoutId ? {workoutId:request.workoutId} : {}),template,summary:lines.join('\n')} };
  }
  const namedExercise = exercises.find(exercise => [exercise.name.zh, exercise.name.en].some(name => message.toLowerCase().includes(name.toLowerCase())));
  if (/换|替换|replace|swap/i.test(message) && namedExercise && profile && request?.task === 'ADJUST_TODAY') {
    const index = request.template.items.findIndex(item => item.exerciseId === namedExercise.id);
    if (index >= 0 && (!request.workoutId || lockedItemIndexes && !lockedItemIndexes.includes(index))) {
      const replacement = discomfortReplacement(namedExercise.id, profile);
      if (replacement) {
        const items = request.template.items.map((item,i) => i === index ? {...replacement, sets: Math.min(item.sets,4)} : item);
        const after = exercises.find(exercise => exercise.id === replacement.exerciseId)!;
        const lines = [fill(copy.replacement,{before:namedExercise.name[locale],after:after.name[locale]})];
        return {lines,response:{...identity!,type:'today_adjustment',target:request.target,...(request.workoutId?{workoutId:request.workoutId}:{}),template:{...request.template,items,estimatedMinutes:estimatePlannedMinutes(items)},summary:lines.join(' ')}};
      }
    }
    return {lines:[locale==='zh'?'目前没有符合已确认器械和注意部位的替换动作。可以补充器械条件，或开启 AI 讨论。':'No replacement matches the confirmed equipment and cautions. Add equipment details or enable AI to discuss alternatives.']};
  }
  if (namedExercise && /怎么|要点|指导|做法|how|tips|technique|form/i.test(message)) return {lines:[namedExercise.name[locale],...namedExercise.steps[locale],...namedExercise.cautions[locale]],guideExerciseId:namedExercise.id};
  if (/15\s*(?:分钟|minutes?|mins?)|十五分钟|时间不够|short|less time/i.test(message) && profile && !(request?.task === 'ADJUST_TODAY' && request.workoutId)) {
    const items=basicItems({...profile,sessionMinutes:15,scheduleOriginalText:'15 minutes'},0).items;
    if(items.length)return {lines:[locale==='zh'?'可以做这份约 15 分钟的短版；按实际完成情况记录。':'Try this approximately 15-minute session and record what you complete.',...items.map(item=>`${exercises.find(exercise=>exercise.id===item.exerciseId)!.name[locale]} · ${item.sets} ${locale==='zh'?'组':'sets'} · ${'reps' in item.target?`${item.target.reps} ${locale==='zh'?'次':'reps'}`:`${'durationSeconds' in item.target?item.target.durationSeconds:0} ${locale==='zh'?'秒':'seconds'}`}`)]};
  }
  if (/这周|本周|回顾|this week|review/i.test(message)) return { lines:copy.review,review:true };
  return { lines: locale==='zh' ? ['我可以解释动作要点、根据现有训练单给出短版或替换建议，也可以打开本周回顾。','你可以说“徒手深蹲怎么做”或“今天只有 15 分钟”。更复杂的计划调整可以开启 AI 后讨论。'] : ['I can explain exercise technique, suggest a shorter session or a replacement from your current plan, and open your weekly review.','Try “How do I do a bodyweight squat?” or “I only have 15 minutes.” Enable AI to discuss more detailed plan changes.'] };
}
