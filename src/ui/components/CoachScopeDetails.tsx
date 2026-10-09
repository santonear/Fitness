import { exercises } from '../../catalog/exercises';

const labels: Record<string, [string, string]> = {
  goal: ['目标', 'Goal'], conditions: ['训练条件', 'Conditions'], experience: ['经验', 'Experience'],
  venue: ['场地', 'Location'], equipment: ['器械', 'Equipment'], restrictions: ['动作限制', 'Restrictions'],
  otherConditions: ['其他偏好', 'Other preferences'], sessionMinutes: ['每次分钟数', 'Minutes per session'],
  usualStartTime: ['常用开始时间', 'Usual start time'], body: ['身体资料', 'Body information'], history: ['已授权历史', 'Approved history'],
  confirmedSummary: ['已确认理解', 'Confirmed understanding'], dates: ['训练日期', 'Training dates'],
  schedule: ['逐日安排', 'Daily schedule'], date: ['日期', 'Date'], startTime: ['开始时间', 'Start time'],
  durationMinutes: ['分钟数', 'Minutes'], timeZone: ['时区', 'Time zone'], value: ['数值', 'Value'],
  source: ['来源', 'Source'], recordedAt: ['资料更新时间', 'Record updated'], observedOn: ['测量日期', 'Observed on'],
  unit: ['单位', 'Unit'], age: ['年龄', 'Age'], biologicalSex: ['性别', 'Sex'], heightCm: ['身高（cm）', 'Height (cm)'],
  weightKg: ['体重（kg）', 'Weight (kg)'], waistCm: ['腰围（cm）', 'Waist (cm)'], bodyFatPercent: ['体脂率', 'Body fat percent'],
  conversation: ['对话摘录', 'Conversation excerpts'], role: ['说话者', 'Speaker'], content: ['内容', 'Content'],
  latestMessage: ['本次回复', 'Current reply'], dailyFocus: ['逐日重点', 'Daily focus'], focus: ['重点', 'Focus'],
  name: ['名称', 'Name'], days: ['训练内容', 'Training content'], exercises: ['动作', 'Exercises'],
  exerciseId: ['动作', 'Exercise'], targetSets: ['目标组', 'Target sets'], reps: ['次数', 'Repetitions'],
  loadGrams: ['重量（g）', 'Load (g)'], durationSeconds: ['动作秒数', 'Active seconds'], restSeconds: ['休息秒数', 'Rest seconds'],
  setTimings: ['组时长', 'Set timing'], notes: ['说明', 'Notes'], request: ['修改要求', 'Requested changes'],
  order: ['顺序', 'Order'], metricType: ['计量方式', 'Metric'], distanceMeters: ['距离（m）', 'Distance (m)'],
};
const values: Record<string, [string, string]> = {
  profile: ['个人资料', 'Profile'], 'onboarding-v4': ['新手引导资料', 'Onboarding profile'],
  'legacy-onboarding': ['早期引导资料', 'Earlier onboarding'],
  'body-weight-observation': ['已保存体重测量', 'Saved weight measurement'],
  'body-observation': ['已保存身体测量', 'Saved body measurement'],
  user: ['你', 'You'], assistant: ['芽芽', 'Coach'], reps_load: ['次数与负重', 'Repetitions and load'],
  reps: ['次数', 'Repetitions'], duration: ['时长', 'Duration'], duration_distance: ['时长与距离', 'Duration and distance'],
};

/** Readable, escaped React text; this component never interprets model data as HTML/actions. */
export function CoachScopeDetails({ value, locale }: { value: unknown; locale: 'zh' | 'en' }) {
  const zh = locale === 'zh';
  function render(item: unknown, key = '', depth = 0): React.ReactNode {
    if (item === undefined || item === null) return <span>{zh ? '未知／未提供' : 'Unknown / not supplied'}</span>;
    if (depth > 12) return <span>{zh ? '内容层级过多，请简化后发送' : 'Simplify deeply nested content before sending'}</span>;
    if (Array.isArray(item)) return item.length ? <ol>{item.map((child, index) => <li key={index}>{render(child, key, depth + 1)}</li>)}</ol> : <span>{zh ? '未提供' : 'Not supplied'}</span>;
    if (typeof item === 'object') return <dl>{Object.entries(item).map(([field, child]) => <div key={field}><dt>{labels[field]?.[zh ? 0 : 1] ?? field}</dt><dd>{render(child, field, depth + 1)}</dd></div>)}</dl>;
    if (key === 'exerciseId') return exercises.find(exercise => exercise.id === item)?.name[locale] ?? String(item);
    if (['source', 'role', 'metricType'].includes(key) && typeof item === 'string' && values[item]) return values[item][zh ? 0 : 1];
    return <span style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{String(item)}</span>;
  }
  return <div className="coach-scope-details">{render(value)}</div>;
}
