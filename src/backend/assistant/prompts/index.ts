import { v3PromptSections } from './generated';
export { v3PromptSections };

export type V3Task = 'ONBOARD_PLAN' | 'ADJUST_TODAY' | 'MODIFY_PLAN' | 'PERIOD_REVIEW';
const taskFiles: Record<V3Task, keyof typeof v3PromptSections> = {
  ONBOARD_PLAN:'tasks/plan', ADJUST_TODAY:'tasks/today', MODIFY_PLAN:'tasks/modify', PERIOD_REVIEW:'tasks/review',
};

export function v3Prompt(stage:'text'|'attachment',task?:V3Task,repairErrors?:string) {
  const sections:string[]=[v3PromptSections.persona,v3PromptSections.safety,v3PromptSections[stage==='text'?'text':'intent']];
  if(task) sections.push(v3PromptSections[taskFiles[task]]);
  if(repairErrors) sections.push(`${v3PromptSections.repair}\nOnly these fields need correction: ${repairErrors.slice(0,1000)}`);
  return sections.join('\n\n');
}
