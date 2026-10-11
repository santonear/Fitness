import type { CoachRequest, CoachResponse } from './contracts';
import type { CoachProfile } from '../domain/v8/contracts';
import { exercises } from '../catalog/exercises';
import { discomfortReplacement } from '../application/rules/basic-items';
import { estimatePlannedMinutes } from '../application/rules/duration-estimate';
import zh from '../i18n/features/coach/local.zh.json';
import en from '../i18n/features/coach/local.en.json';

export type LocalReply = { lines: string[]; review?: boolean; response?: CoachResponse };
const fill = (s: string, values: Record<string,string|number>) => s.replace(/\{(\w+)\}/g, (_,key) => String(values[key] ?? ''));
/** Read-only local candidates. Saving still uses the normal explicit acceptance transaction. */
export function localCoachReply(message: string, request?: CoachRequest, profile?: CoachProfile, locale: 'zh'|'en' = request?.locale ?? 'zh', lockedItemIndexes?: readonly number[]): LocalReply {
  const copy = locale === 'en' ? en : zh;
  const identity = request && { requestId: request.requestId, restoreGeneration: request.restoreGeneration, mutationAllowed: false as const };
  if (/疼|痛|不适|不舒服|pain|hurt|discomfort/i.test(message)) {
    const lines = [...copy.pain, copy.safety];
    if (request?.task !== 'ADJUST_TODAY' || !profile) return { lines };
    const areas: CoachProfile['cautions'] = [];
    for (const [pattern,area] of [[/膝|knee/i,'knee'],[/腰|背|back/i,'back'],[/肩|shoulder/i,'shoulder'],[/腕|wrist/i,'wrist']] as const) if (pattern.test(message)) areas.push(area);
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
  if (/时间不够|没时间|赶时间|短一点|short|less time|not enough time/i.test(message) && request?.task === 'ADJUST_TODAY') {
    if (request.workoutId && !lockedItemIndexes) return { lines: [...copy.time.slice(0,2), fill(copy.time[2],{before:request.template.estimatedMinutes}),copy.noShort] };
    const keep = Math.max(3,...(lockedItemIndexes ?? []).map(index=>index+1));
    const items = request.template.items.slice(0,keep).map((item,index) => lockedItemIndexes?.includes(index) ? item : ({ ...item, sets: Math.min(2,item.sets) }));
    const template = { ...request.template, items, estimatedMinutes: estimatePlannedMinutes(items) };
    const lines = copy.time.map(line => fill(line,{before:request.template.estimatedMinutes,after:template.estimatedMinutes}));
    if (template.estimatedMinutes >= request.template.estimatedMinutes) return { lines:[...lines.slice(0,3),copy.noShort] };
    return { lines, response:{...identity!,type:'today_adjustment',target:request.target,...(request.workoutId ? {workoutId:request.workoutId} : {}),template,summary:lines.join('\n')} };
  }
  if (/这周|本周|回顾|this week|review/i.test(message)) return { lines:copy.review,review:true };
  return { lines:copy.unknown };
}
