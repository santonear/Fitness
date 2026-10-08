import type { OnboardingKey } from '../../../domain/onboarding-v4';
type Pair = [string, string];
export const questionTitles: Record<OnboardingKey, Pair> = {
  biologicalSex:['你的性别是？','What is your sex?'], age:['你的年龄是？','How old are you?'], heightCm:['你的身高是？','What is your height?'], weightKg:['你的体重是？','What is your weight?'], waistCm:['你的腰围是？','What is your waist measurement?'],
  goal:['你想达到什么训练目标？','What are your training goals?'], experience:['你的训练经验如何？','What is your training experience?'], location:['你通常在哪里训练？','Where do you train?'], equipment:['你有哪些可用器械？','What equipment do you have?'], safety:['你有哪些动作限制？','What movement limitations should we consider?'], schedule:['你的训练时间安排是？','When and how long would you like to train?'], preferences:['还有什么想告诉我们？','Anything else you would like us to know?'],
};
export const optionLabels: Partial<Record<OnboardingKey, Pair[]>> = {
  biologicalSex:[['女性','Female'],['男性','Male']],
  goal:[['减脂','Fat loss'],['增肌','Build muscle'],['提升力量','Build strength'],['提升耐力','Improve endurance'],['改善灵活性','Improve mobility'],['保持健康','Stay active']],
  experience:[['完全新手','Complete beginner'],['有一些经验','Some experience'],['规律训练中','Training regularly']],
  location:[['家里','Home'],['健身房','Gym'],['户外','Outdoors'],['公司健身区','Workplace gym']],
  equipment:[['徒手','Bodyweight'],['哑铃','Dumbbells'],['弹力带','Resistance bands'],['跑步机','Treadmill'],['壶铃','Kettlebells'],['杠铃','Barbell']],
  safety:[['膝盖不适','Knee discomfort'],['肩部不适','Shoulder discomfort'],['腰背不适','Back discomfort'],['手腕不适','Wrist discomfort'],['无已知限制','No known limitations']],
};
export const customLabels: Partial<Record<OnboardingKey, Pair>> = { goal:['自定义目标','Custom goal'], experience:['经验补充','Experience details'], location:['其他训练场地','Other training venues'], equipment:['其他器械','Other equipment'], safety:['其他动作限制','Other movement limitations'] };
export function displayAnswer(value: string | number | string[], locale: 'zh'|'en') {
  const labels = Object.values(optionLabels).flat();
  const label = (v: string) => labels.find(pair=>pair[0]===v)?.[locale==='zh'?0:1] ?? v;
  return Array.isArray(value) ? value.map(label).join(' · ') : String(value).split('\n').map(label).filter(Boolean).join(' · ');
}
