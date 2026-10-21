import { describe, expect, it } from 'vitest';
import { activityFactor, energyTargets, lossBlock, macroTargets, restingEnergy } from '../../src/application/rules/energy';

describe('energy (V9.15 calculators)', () => {
  it('uses Mifflin-St Jeor resting energy, with the midpoint when sex is not given', () => {
    expect(restingEnergy({ sex: 'male', age: 30, heightCm: 175, weightKg: 70 })).toBeCloseTo(1648.75);
    expect(restingEnergy({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25);
    expect(restingEnergy({ sex: 'unspecified', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1403.25);
  });

  it('takes activity from planned sessions per week', () => {
    expect([0, 2, 3, 4, 5, 6].map(activityFactor)).toEqual([1.2, 1.375, 1.375, 1.55, 1.55, 1.725]);
  });

  it('sets goals ±10% around maintenance, never below resting energy', () => {
    const result = energyTargets({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 }, 3, 'lose');
    expect(result.maintenance).toBe(1815);
    expect(result.targets).toEqual({ lose: 1634, maintain: 1815, gain: 1997 });
    expect(result.target).toBe(1634);
    expect(result.weeklyChangeKg).toBeCloseTo(-0.15);
    const sedentary = energyTargets({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 }, 0, 'lose');
    expect(sedentary.targets.lose).toBeGreaterThanOrEqual(sedentary.resting);
  });

  it('blocks fat loss in pregnancy, postpartum, under 18 or with a low BMI', () => {
    expect(lossBlock({ population: 'pregnant' })).toBe('pregnant');
    expect(lossBlock({ population: 'postpartum' })).toBe('postpartum');
    expect(lossBlock({ age: 16 })).toBe('minor');
    expect(lossBlock({ age: 30, heightCm: 170, weightKg: 50 })).toBe('lowBmi');
    expect(lossBlock({ age: 30, heightCm: 170, weightKg: 65 })).toBeUndefined();
  });

  it('splits calories into grams at 4/4/9 kcal per gram and per meal', () => {
    const result = macroTargets(2000, 'balanced', 3);
    expect(result.carbs).toEqual({ grams: 275, kcal: 1100, percent: 55 });
    expect(result.protein).toEqual({ grams: 75, kcal: 300, percent: 15 });
    expect(result.fat).toEqual({ grams: 67, kcal: 600, percent: 30 });
    expect(result.perMeal).toEqual({ carbs: 92, protein: 25, fat: 22 });
    expect(macroTargets(2000, 'protein', 9).perMeal.protein).toBe(21);
  });
});
