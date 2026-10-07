import type { GuidedAnswer, GuidedQuestion } from './GuidedOnboarding';

export type Copy = readonly [string, string];
export const numbers: Partial<Record<GuidedQuestion, { min: number; max: number; step: number; sample: number; unit: string }>> = {
  age: { min: 18, max: 110, step: 1, sample: 30, unit: '' },
  heightCm: { min: 100, max: 230, step: 1, sample: 170, unit: 'cm' },
  weightKg: { min: 30, max: 300, step: .5, sample: 70, unit: 'kg' },
  waistCm: { min: 40, max: 200, step: .5, sample: 80, unit: 'cm' },
  bodyFatPercent: { min: 3, max: 65, step: .5, sample: 20, unit: '%' },
};
export const prompts: Record<GuidedQuestion, Copy> = {
  biologicalSex: ['你的生理性别是？', 'What is your biological sex?'],
  age: ['你的年龄是多少？', 'how old are you?'], heightCm: ['你的身高是多少？', 'what is your height?'],
  weightKg: ['你现在的体重是多少？', 'what is your current weight?'], waistCm: ['你测量过腰围吗？', 'have you measured your waist?'],
  bodyFatPercent: ['你测量过体脂率吗？', 'have you measured your body fat?'], goal: ['你希望达成什么目标？', 'what would you like to work towards?'],
  experience: ['你的训练经验如何？', 'what is your training experience?'], location: ['你通常在哪里训练？', 'where will you train?'],
  equipment: ['你有哪些可用器械？', 'what equipment can you use?'], time: ['每周想安排几天训练？', 'how many days a week work for you?'],
  preferences: ['你喜欢哪些运动？', 'what activities do you enjoy?'], safety: ['有需要照顾的身体限制吗？', 'anything we should take care with?'],
};
export const choices: Partial<Record<GuidedQuestion, Copy[]>> = {
  biologicalSex: [['女性', 'Female'], ['男性', 'Male'], ['其他或不确定', 'Other or unsure'], ['不愿透露', 'Prefer not to say']],
  goal: [['减少体脂', 'Lose fat'], ['增加肌肉', 'Build muscle'], ['提升力量', 'Get stronger'], ['改善耐力', 'Build endurance'], ['改善灵活性', 'Move more freely'], ['保持健康', 'Feel healthier']],
  experience: [['刚开始', 'Just starting'], ['有一些经验', 'Some experience'], ['持续规律训练', 'Regular training']],
  location: [['家里', 'At home'], ['健身房', 'At the gym'], ['户外', 'Outdoors'], ['多种场地', 'A mix of places']],
  equipment: [['徒手', 'No equipment'], ['哑铃', 'Dumbbells'], ['杠铃', 'Barbell'], ['弹力带', 'Resistance bands'], ['固定器械', 'Machines'], ['其他器械', 'Other equipment']],
  time: [['每周1–2天', '1–2 days / week'], ['每周3天', '3 days / week'], ['每周4天', '4 days / week'], ['每周5天或更多', '5 or more days / week'], ['时间不固定', 'My schedule varies']],
  preferences: [['没有特别偏好', 'No particular preference'], ['力量训练', 'Strength training'], ['步行', 'Walking'], ['跑步', 'Running'], ['骑行', 'Cycling'], ['灵活性训练', 'Mobility']],
  safety: [['没有已知限制', 'No known restrictions'], ['有，需要说明', 'Yes, something to share']],
};
export const durationChoices: Copy[] = [['每次15分钟', '15 minutes'], ['每次30分钟', '30 minutes'], ['每次45分钟', '45 minutes'], ['每次60分钟', '60 minutes'], ['单次时间不固定', 'It varies']];
export const avoidChoices: Copy[] = [['没有特别想避开的运动', 'Nothing in particular'], ['避免：跑跳', 'Running / jumping'], ['避免：大重量', 'Heavy weights'], ['避免：高冲击运动', 'High-impact exercise']];
export const categories: { label: Copy; keys: GuidedQuestion[] }[] = [
  { label: ['关于你', 'ABOUT YOU'], keys: ['age', 'biologicalSex', 'heightCm', 'weightKg'] },
  { label: ['可选指标', 'OPTIONAL'], keys: ['waistCm', 'bodyFatPercent'] },
  { label: ['你的目标', 'YOUR GOAL'], keys: ['goal'] },
  { label: ['训练经验', 'EXPERIENCE'], keys: ['experience'] },
  { label: ['训练环境', 'YOUR SPACE'], keys: ['location', 'equipment'] },
  { label: ['时间条件', 'YOUR TIME'], keys: ['time'] },
  { label: ['运动偏好', 'PREFERENCES'], keys: ['preferences'] },
  { label: ['照顾自己', 'TAKE CARE'], keys: ['safety'] },
];
export function valuesOf(answer?: GuidedAnswer): string[] {
  if (answer?.status !== 'answered') return [];
  return Array.isArray(answer.value) ? answer.value : [String(answer.value)];
}
export function translatedValue(value: string, english: boolean): string {
  if (!english) return value === '徒手' ? '无器械（徒手）' : value;
  const all = [...Object.values(choices).flat(), ...durationChoices, ...avoidChoices];
  const match = all.find(item => item[0] === value);
  if (match) return match[1];
  if (value.startsWith('有，需要说明：')) return `Restriction: ${value.slice(7)}`;
  if (value.startsWith('避免：')) return `Avoid: ${value.slice(3)}`;
  if (value.startsWith('单次时长：')) return `Session length: ${value.slice(5)}`;
  return value;
}
export function validNumber(value: string | number, config: NonNullable<typeof numbers.age>) {
  if (String(value).trim() === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= config.min && n <= config.max && (config.unit !== '' || Number.isInteger(n));
}
