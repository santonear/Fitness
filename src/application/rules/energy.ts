// 我的 › 卡路里计算器 / 宏量营养计算器 (UIUX20261008 V9.15). Pure estimates on this device only.
// Resting energy: Mifflin-St Jeor (1990), the equation the Academy of Nutrition and Dietetics review
// (Frankenfield 2005) found most accurate for healthy adults. 4 / 4 / 9 kcal per gram (Atwater).

export type EnergySex = 'male' | 'female' | 'unspecified';
export type EnergyGoal = 'lose' | 'maintain' | 'gain';
export interface EnergyInput { sex: EnergySex; age: number; heightCm: number; weightKg: number }

export const ENERGY_LIMITS = { age: [13, 80], heightCm: [120, 220], weightKg: [30, 300] } as const;
/** ±10 % around maintenance; a loss target never goes below resting energy. */
export const GOAL_FACTOR: Record<EnergyGoal, number> = { lose: 0.9, maintain: 1, gain: 1.1 };
const KCAL_PER_KG = 7700;

/** Mifflin-St Jeor resting energy, kcal/day. Unspecified sex uses the midpoint of the two constants. */
export function restingEnergy({ sex, age, heightCm, weightKg }: EnergyInput): number {
  const constant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + constant;
}

/**
 * Daily activity from the plan's sessions per week instead of a self-rated level (Bo 2026-10-21):
 * the usual 1.2 / 1.375 / 1.55 / 1.725 factors.
 */
export function activityFactor(sessionsPerWeek: number): number {
  if (sessionsPerWeek <= 0) return 1.2;
  if (sessionsPerWeek <= 3) return 1.375;
  if (sessionsPerWeek <= 5) return 1.55;
  return 1.725;
}

export interface EnergyResult { resting: number; maintenance: number; targets: Record<EnergyGoal, number>; target: number; weeklyChangeKg: number }
const round = (value: number, step = 1) => Math.round(value / step) * step;

export function energyTargets(input: EnergyInput, sessionsPerWeek: number, goal: EnergyGoal): EnergyResult {
  const resting = restingEnergy(input), maintenance = resting * activityFactor(sessionsPerWeek);
  const targets = {
    lose: round(Math.max(resting, maintenance * GOAL_FACTOR.lose)),
    maintain: round(maintenance),
    gain: round(maintenance * GOAL_FACTOR.gain),
  };
  const target = targets[goal];
  return { resting: round(resting), maintenance: targets.maintain, targets, target, weeklyChangeKg: round((target - maintenance) * 7 / KCAL_PER_KG, 0.05) };
}

/** Why 减脂 is not offered: pregnancy, postpartum, under 18 or a BMI under 18.5. */
export type LossBlock = 'pregnant' | 'postpartum' | 'minor' | 'lowBmi';
export function lossBlock(input: { age?: number; heightCm?: number; weightKg?: number; population?: string }): LossBlock | undefined {
  if (input.population === 'pregnant') return 'pregnant';
  if (input.population === 'postpartum') return 'postpartum';
  if (input.age !== undefined && input.age < 18) return 'minor';
  if (input.heightCm && input.weightKg && input.weightKg / (input.heightCm / 100) ** 2 < 18.5) return 'lowBmi';
  return undefined;
}

/** Carbs / protein / fat shares. Balanced follows 中国居民膳食指南（2022）ranges. */
export const MACRO_PRESETS = { balanced: [55, 15, 30], protein: [45, 25, 30], lowCarb: [35, 30, 35] } as const;
export type MacroPreset = keyof typeof MACRO_PRESETS;
export const MEALS_RANGE = [1, 6] as const;

export interface MacroLine { grams: number; kcal: number; percent: number }
export interface MacroResult { carbs: MacroLine; protein: MacroLine; fat: MacroLine; perMeal: { carbs: number; protein: number; fat: number } }

export function macroTargets(kcal: number, preset: MacroPreset, meals: number): MacroResult {
  const [c, p, f] = MACRO_PRESETS[preset];
  const line = (percent: number, perGram: number): MacroLine => { const part = kcal * percent / 100; return { grams: Math.round(part / perGram), kcal: Math.round(part), percent }; };
  const carbs = line(c, 4), protein = line(p, 4), fat = line(f, 9);
  const n = Math.min(MEALS_RANGE[1], Math.max(MEALS_RANGE[0], Math.round(meals)));
  return { carbs, protein, fat, perMeal: { carbs: Math.round(carbs.grams / n), protein: Math.round(protein.grams / n), fat: Math.round(fat.grams / n) } };
}
