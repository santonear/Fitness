import { type Plan, type EngineProfile } from "../contracts";
import { Rules, type RuleValue } from "../data";
import { safety } from "../gates/strength-scoring";
import { strengthRoles } from "../dose";

export type Session = Plan["templates"][number];

export interface Facts {
  sessions: Session[];
  items: Session["items"];
  rt: Session[];
  sets: Record<string, number>;
  patterns: Set<string>;
  aerobic: number;
  hardAerobic: number;
  seconds: number;
  resistance: number;
  mobility: number;
  balanceDays: number;
  sessionSeconds?: Map<Session, number>;
  exposures?: Record<string, number>;
  directSets?: Record<string, number>;
  conditioningSeconds?: number;
  primaryPatterns?: Set<string>;
  sessionPatterns?: Set<string>[];
  mainSetsBySession?: Map<Session, Record<string, number>>;
}

export type Item = Session["items"][number];

export interface ItemFacts {
  work: boolean;
  main: boolean;
  credit: Record<string, number>;
  pattern?: string;
  patterns: string[];
  aerobic: number;
  hardAerobic: number;
  conditioningSeconds: number;
  mobility: number;
  balance: boolean;
}

export interface SessionFacts {
  session: Session;
  items: Session["items"];
  work: Session["items"];
  sets: Record<string, number>;
  patterns: string[];
  aerobic: number;
  hardAerobic: number;
  seconds: number;
  resistance: number;
  mobility: number;
  balance: boolean;
  directSets: Record<string, number>;
  conditioningSeconds: number;
  mainSets: Record<string, number>;
  contributions: Map<Item, ItemFacts>;
  setEntries: [string, number][];
  directSetEntries: [string, number][];
}
export interface Context {
  plan: Plan;
  p: EngineProfile;
  r: Rules;
  f: Facts;
  v: RuleValue;
  timing?: GenerationTimingBatch;
}

export interface GenerationTimingBatch {
  profile: EngineProfile;
  rules: Rules;
  baselineSessions: Set<Session>;
  baselineItems: Set<Item>;
  goalItems: WeakMap<
    Item,
    {
      name: string;
      source: RuleValue;
      role: "main" | "accessory" | undefined;
      value: number;
    }[]
  >;
  strengthSafety?: ReturnType<typeof safety>;
  values: WeakMap<Session, { warmup: number; cooldown: number }>;
  roles: WeakMap<Session, ReturnType<typeof strengthRoles>>;
  cooldownStretch: WeakMap<Session, number>;
}

export type Satisfaction = (c: Context) => number | null;
