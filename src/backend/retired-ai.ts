import { ControlError } from './store';
/** Legacy candidate parsing remains available; legacy model execution does not. */
export function assertCurrentAiExecution(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if ('dialogue' in value || ('operation' in value && ['understand','generate'].includes(String(value.operation)) && !('coach' in value)))
    throw new ControlError('AI_CONTRACT_RETIRED',410);
}
