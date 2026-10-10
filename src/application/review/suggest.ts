import type { SuggestionInput, ReviewSuggestion, PlanProposal } from './contracts';
import { computeExerciseEvidence } from './evidence';

/** Pure candidates only. No saved plans or facts are mutated here. */
export function suggestChange(input: SuggestionInput): ReviewSuggestion | null {
 const { plan, current, previous } = input;
 const base: PlanProposal = { goalText: plan.goalText, weeklyTarget: plan.weeklyTarget,
  sessionMinutes: plan.sessionMinutes, scheduleOriginalText: plan.scheduleOriginalText,
  templates: structuredClone(plan.templates), reasons: ['', '', ''] };
 const candidate = (rule: ReviewSuggestion['rule'], proposal: PlanProposal, detail = ''): ReviewSuggestion | null => {
  const id = `${current.from}:${plan.id}:${rule}:${detail}`;
  return input.dismissedIds.includes(id) ? null : { id, rule, summary: rule, basedOnVersionId: plan.id, proposal };
 };
 // A dismissed suggestion does not fall through into another suggestion this week.
 if (input.dismissedIds.some(id => id.startsWith(`${current.from}:${plan.id}:`))) return null;
 const rows = input.workouts.filter(w => w.planVersionId === plan.id && w.localDate >= previous.from && w.localDate <= current.to && !['in_progress','abandoned'].includes(w.status))
  .sort((a,b) => b.startedAt.localeCompare(a.startedAt));
 // Do not offer load increases while any relevant discomfort is unresolved.
 const discomfort = new Set(rows.flatMap(w => computeExerciseEvidence(w).discomfortExerciseIds));
 if (current.reasonCounts.time >= 2 && !plan.templates.some(t => t.id === 'review-short')) {
  const source=plan.templates.find(t => t.items.length >= 3);
  if(source) return candidate('time', { ...base, templates: [...base.templates, { ...structuredClone(source), id:'review-short', name:'20 min', estimatedMinutes:20, items:source.items.slice(0,3).map(i=>({...structuredClone(i),sets:2})) }] });
 }
 for (const id of new Set(plan.templates.flatMap(t=>t.items.map(i=>i.exerciseId)))) {
  if(discomfort.has(id))continue;
  const relevant=rows.filter(w=>w.plannedExercises?.some(e=>e.exerciseId===id));
  if(relevant.length>=3&&relevant.slice(0,3).every(w=>computeExerciseEvidence(w).easyCompletedExerciseIds.includes(id))) {
   let changed=false;
   for(const template of base.templates)for(const item of template.items)if(item.exerciseId===id) {
    if(item.target.metricType==='reps_load'){item.target.loadGrams+=1000;changed=true;}
    else if(item.target.metricType==='reps'){item.target.reps+=1;changed=true;}
   }
   if(changed)return candidate('progression',base,id);
  }
 }
 if(current.complete>=plan.weeklyTarget&&previous.complete>=plan.weeklyTarget&&plan.weeklyTarget<7)
  return candidate('frequency',{...base,weeklyTarget:plan.weeklyTarget+1});
 // A newly saved plan is not evidence of two weeks without training.
 if(plan.createdAt.slice(0,10)<previous.from&&current.complete===0&&previous.complete===0&&plan.weeklyTarget>2) {
  const source=plan.templates.find(t=>t.items.length>=3);
  if(source)return candidate('restart',{...base,weeklyTarget:2,templates:[{...structuredClone(source),id:'review-short',name:'20 min',estimatedMinutes:20,items:source.items.slice(0,3).map(i=>({...structuredClone(i),sets:2}))}]});
 }
 return null;
}

