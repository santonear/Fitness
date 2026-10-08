import { z } from 'zod';

export const onboardingKeys = ['biologicalSex','age','heightCm','weightKg','waistCm','goal','experience','location','equipment','safety','schedule','preferences'] as const;
export type OnboardingKey = typeof onboardingKeys[number];
export const durations = [30,40,50,60,70,80,90,100,110,120] as const;
export const wheelRanges = { age: [12,70], heightCm: [100,230], weightKg: [30,300], waistCm: [40,200] } as const;
export type Answer = { status: 'answered'; value: string | number | string[] } | { status: 'skipped' };
export type Answers = Partial<Record<OnboardingKey, Answer>>;
const text = z.string().trim().min(1).max(1000);
const list = z.array(text).min(1).max(20).refine(v => new Set(v).size === v.length);
const fields: Record<OnboardingKey, z.ZodType> = {
  biologicalSex: z.enum(['女性','男性']), age: z.number().int().min(12).max(70), heightCm: z.number().int().min(100).max(230),
  weightKg: z.number().int().min(30).max(300), waistCm: z.number().int().min(40).max(200),
  goal: list, experience: text, location: list, equipment: list,
  safety: list.refine(v => !v.includes('无已知限制') || v.length === 1),
  schedule: z.array(z.string()).min(2).max(3).refine(v => (v[0] === '' || /^([01]?\d|2[0-3])$/.test(v[0])) && (v[1] === '' || durations.some(n => String(n) === v[1])) && (v.length === 2 || v[2] === '' || /^[1-7]$/.test(v[2]))), preferences: text,
};
export function validV4Answer(key: string, answer: Answer): boolean {
  return onboardingKeys.includes(key as OnboardingKey) && (answer.status === 'skipped' || fields[key as OnboardingKey].safeParse(answer.value).success);
}
export function v4Complete(answers: Record<string, Answer>) { return onboardingKeys.every(key => answers[key] && validV4Answer(key, answers[key])) && !(answers.schedule?.status === 'answered' && (answers.schedule.value as string[]).includes('')); }
export function answered(answers: Record<string, Answer>, key: string) { const a = answers[key]; return a?.status === 'answered' ? a.value : undefined; }
export function localAgeAccess(answers: Record<string, Answer>): 'adult' | 'minor' | 'unknown' {
  const age = answered(answers, 'age'); return typeof age === 'number' ? age >= 18 ? 'adult' : 'minor' : 'unknown';
}
