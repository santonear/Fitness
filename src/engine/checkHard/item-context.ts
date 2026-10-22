import type { EngineProfile, GateOutcome, Plan } from '../contracts';
import type { Exercise, Rules } from '../data';
import { newWeek } from '../dose';
type Template = Plan['templates'][number];
type Item = Template['items'][number];
export interface ItemCheckContext {
  e: Exercise;
  p: EngineProfile;
  g: GateOutcome;
  r: Rules;
  t: Template;
  item: Item;
  index: number;
  pres: Item['prescription'];
  work: boolean;
  sourceRamp: boolean;
  ramps: Map<number, number>;
  seen: Set<string>;
  ladders: Set<string>;
  intro: ReturnType<typeof newWeek>;
  add: (code: string, ruleId: string, reason: string, templateId?: string, itemIndex?: number) => number;
}
