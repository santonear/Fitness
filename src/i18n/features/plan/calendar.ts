/** 计划 week/month toggle and month calendar. States are described in words for screen readers. */
export const planCalendarCopy = {
  zh: {
    view: '计划视图', week: '周', month: '月', prev: '上个月', next: '下个月', calendar: '{month} 训练日历',
    states: { done: '练完了', partial: '练了一部分', planned: '计划', missed: '没练', rest: '休息' },
    today: '今天', legend: '图例', counts: '这个月 · 练完 {done} 次 · 练了一部分 {partial} 次 · 还有 {planned} 次',
    pick: '点一天，看这天练什么。', restDay: '这天是休息日。', beforeStart: '计划还没开始。',
    recorded: '这天的记录', sets: '{done} / {planned} 组', time: '{start}–{end}', planned: '这天的计划', minutes: '约 {count} 分钟',
    otherSession: '这天练的不是计划里的训练。',
  },
  en: {
    view: 'Plan view', week: 'Week', month: 'Month', prev: 'Previous month', next: 'Next month', calendar: '{month} training calendar',
    states: { done: 'Done', partial: 'Partly done', planned: 'Planned', missed: 'Not trained', rest: 'Rest' },
    today: 'Today', legend: 'Legend', counts: 'This month · {done} done · {partial} partly done · {planned} to go',
    pick: 'Tap a day to see its session.', restDay: 'This is a rest day.', beforeStart: 'The plan has not started yet.',
    recorded: 'What you did', sets: '{done} / {planned} sets', time: '{start}–{end}', planned: 'Planned for this day', minutes: 'About {count} min',
    otherSession: 'The training this day was not from the plan.',
  },
} as const;
