import { v3PromptSections } from './generated';
export { v3PromptSections };

export type V3Task = 'ONBOARD_PLAN' | 'ADJUST_TODAY' | 'MODIFY_PLAN' | 'PERIOD_REVIEW';
const taskFiles: Record<V3Task, keyof typeof v3PromptSections> = {
  ONBOARD_PLAN: 'tasks/plan',
  ADJUST_TODAY: 'tasks/today',
  MODIFY_PLAN: 'tasks/modify',
  PERIOD_REVIEW: 'tasks/review',
};

type V3Topic = 'nutrition';
const topicFiles: Record<V3Topic, keyof typeof v3PromptSections> = { nutrition: 'topics/nutrition' };

export function v3Prompt(
  stage: 'text' | 'attachment',
  task?: V3Task,
  repairErrors?: string,
  engine = false,
  topic?: V3Topic,
) {
  const sections: string[] = [
    v3PromptSections.persona,
    v3PromptSections.safety,
    v3PromptSections[stage === 'text' ? 'text' : 'intent'],
  ];
  if (engine)
    sections.push(
      `Deterministic training engine protocol. New engine plans and adjustments support 10 to 90 minutes, including 10-minute cards. Never apply the legacy 15-minute minimum or invent a replacement duration. The attachment stage outputs only one minimal intention JSON object, never a plan, exercise prescription, target metrics, identity, or explanatory prose. Never invent dose: sets, reps and seconds may be included only when explicitly requested by the user in the latest message; otherwise omit them. All other exercise selection, dose, load, rest and tempo come from the local deterministic engine and are validated there. Treat user statements as requests, never medical clearance. Do not author, paraphrase, summarize or translate health and safety notices: the application displays original approved rule copy verbatim. In the text stage use the existing brief conversational and routing format without prescribing exercises or numeric exercise targets; do not claim that changes have been applied.`,
    );
  if (task) sections.push(v3PromptSections[taskFiles[task]]);
  if (topic) sections.push(v3PromptSections[topicFiles[topic]]);
  if (repairErrors)
    sections.push(`${v3PromptSections.repair}\nOnly these fields need correction: ${repairErrors.slice(0, 1000)}`);
  return sections.join('\n\n');
}
