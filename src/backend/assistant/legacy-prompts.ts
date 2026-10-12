import { coachV8PromptHeader } from '../coach-v8-prompt-registry';
import type { V3Task } from './prompts/index';

/** Retain the exact V2.1 task header for an operator rollback. V3 never uses it. */
export function legacyAssistantTaskHeader(task: V3Task): string {
  return coachV8PromptHeader(task);
}
