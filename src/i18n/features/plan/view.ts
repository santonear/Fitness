/** V9 plan, draft and home copy (weekly calendar, session tiles, tips). */
export const planViewCopy = {
  zh: {
    week: '一周安排', thisWeek: '本周', sessionsUnit: '次训练', totalMinutes: '约 {count} 分钟', minutes: '{count} 分钟', rest: '休息', done: '已练', partial: '练了一部分', today: '今天',
    suggestedDays: '日子是芽芽建议的，按你方便挪动就行。', why: '为什么这样排', tip: '小建议', moreTips: '还有 {count} 条说明', editEnvironment: '修改训练环境',
    draftTitle: '你的第一版计划', planTitle: '我的计划', accept: '就用这份计划', discuss: '问问芽芽怎么改', saving: '正在保存…', discard: '不要这份计划',
    cautionsExcluded: '已按你选的注意部位换掉了部分动作。', editCautions: '修改注意部位', goal: '目标', exercises: '{count} 个动作',
    sets: '{count} 组', reps: '{count} 次', seconds: '{count} 秒', kg: '{count} 公斤', meters: '{count} 米', chooseLoad: '选一个能稳稳做完的重量',
    effort: { easy: '还能轻松多做几次', moderate: '还能再做 2–3 次', hard: '再做 1 次就到极限' },
    history: '以前的版本', library: '动作库', versionLine: '第 {number} 版 · {date}', readOnly: '只读',
  },
  en: {
    week: 'Week plan', thisWeek: 'This week', sessionsUnit: ' sessions', totalMinutes: 'About {count} min', minutes: '{count} min', rest: 'Rest', done: 'Done', partial: 'Partly done', today: 'Today',
    suggestedDays: 'Yaya suggested these days. Move them to suit you.', why: 'Why this plan', tip: 'A small tip', moreTips: '{count} more notes', editEnvironment: 'Edit training space',
    draftTitle: 'Your first plan', planTitle: 'My plan', accept: 'Use this plan', discuss: 'Ask Yaya to change it', saving: 'Saving…', discard: 'Discard this plan',
    cautionsExcluded: 'Some exercises were swapped for the areas you chose.', editCautions: 'Edit areas', goal: 'Goal', exercises: '{count} exercises',
    sets: '{count} sets', reps: '{count} reps', seconds: '{count} s', kg: '{count} kg', meters: '{count} m', chooseLoad: 'Pick a weight you can move steadily',
    effort: { easy: 'You could easily do several more', moderate: 'You could do 2–3 more', hard: 'One more would be your limit' },
    history: 'Earlier versions', library: 'Exercise library', versionLine: 'Version {number} · {date}', readOnly: 'Read only',
  },
} as const;

/** Reps-in-reserve shown as plain words (P1 #14); the number itself never reaches the screen. */
export function effortWords(rir: readonly [number, number] | undefined, locale: 'zh' | 'en'): string | undefined {
  if (!rir) return undefined;
  const t = planViewCopy[locale].effort, low = Math.min(...rir);
  return low >= 4 ? t.easy : low >= 2 ? t.moderate : t.hard;
}
