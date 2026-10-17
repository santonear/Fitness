import { type Item } from "./types";

export interface AllocatedCapacityDay {
  dayId: string;
  targetSeconds: number;
  fixedSeconds: number;
  usedSeconds: number;
  sourceMinutes: number;
  referenceSetLimit: number;
  items: {
    item: Item;
    unitCredit: Record<string, number>;
    setCostSeconds: number;
    setupSeconds: number;
    maxSets: number;
    minimumSets: number;
  }[];
  stoppedBy:
    | "time"
    | "source_or_hard_cap"
    | "missing_candidates"
    | "minimum_dose";
}

export interface AllocatedVolumeCapacity {
  model: "source_straight_fixed_quota_prefix";
  /** Null is unmeasured, never a zero target that grants automatic satisfaction. */
  byMuscle: Record<string, number | null>;
  totalWorkingSets: number;
  days: AllocatedCapacityDay[];
}
