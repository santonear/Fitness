/**
 * Bo 2026-10-19: pick training days on a month calendar (tap or drag, 1–30 days), then a start time;
 * clear back/home actions on sub-pages; a fresh start for 重新制定计划; tap-or-type birth month.
 */
export const trainingDaysCopy = {
  zh: {
    sub: '在日历上点一天，或按住拖动一次选几天。1 到 30 天都可以。',
    calendar: '{month} 训练日', prev: '上个月', next: '下个月',
    hint: '第一天要在两周内，整个计划不超过 30 天。',
    selected: '已选 {count} 天 · {from} 到 {to}', selectedOne: '已选 1 天 · {from}', none: '还没选训练日', clear: '清空重选',
    chosen: '已选', unavailable: '不可选',
    rest: '每连续 7 天至少留 1 天休息，{dates} 没有排进去。',
    outside: '第一天要在两周内、整个计划不超过 30 天，{dates} 没有排进去。',
    minutes: '每次练多久',
    time: { title: '打算几点开始练？', sub: '日期选好了，再定个大概时间，方便你安排。', label: '开始时间', other: '其他时间',
      presets: [['07:00', '早上 7:00'], ['12:30', '中午 12:30'], ['19:00', '晚上 7:00']] as const },
    text: '每周 {weekly} 次，每次 {minutes} 分钟，共 {count} 天',
    startsAt: '每次 {time} 开始',
    days: '共 {count} 天 · {from} 到 {to}', daysOne: '共 1 天 · {from}', editDays: '改训练日', draftCalendar: '训练日历',
  },
  en: {
    sub: 'Tap a day on the calendar, or press and drag to pick several. Anything from 1 to 30 days.',
    calendar: '{month} training days', prev: 'Previous month', next: 'Next month',
    hint: 'Start within two weeks; the whole plan fits in 30 days.',
    selected: '{count} days picked · {from} to {to}', selectedOne: '1 day picked · {from}', none: 'No training days yet', clear: 'Clear and start over',
    chosen: 'Picked', unavailable: 'Not available',
    rest: 'Every 7 days in a row keep at least one rest day, so {dates} was left out.',
    outside: 'The first day must be within two weeks and the plan within 30 days, so {dates} was left out.',
    minutes: 'How long each time',
    time: { title: 'What time will you usually start?', sub: 'Days are set. Pick a rough time so you can plan around it.', label: 'Start time', other: 'Another time',
      presets: [['07:00', 'Morning 7:00'], ['12:30', 'Noon 12:30'], ['19:00', 'Evening 7:00']] as const },
    text: '{weekly} times a week, {minutes} minutes each time, {count} days in total',
    startsAt: 'Starts at {time}',
    days: '{count} days · {from} to {to}', daysOne: '1 day · {from}', editDays: 'Change training days', draftCalendar: 'Training calendar',
  },
} as const;

/** 回到今天 on every sub-page; unsaved input is cleared after a confirmation. */
export const homeExitCopy = {
  zh: { home: '回到今天', title: '回到今天？', hint: '这一页还没保存的内容会清空。已经保存的计划和训练记录不受影响。', confirm: '清空并回到今天', cancel: '继续填写' },
  en: { home: 'Back to Today', title: 'Go back to Today?', hint: 'Anything not saved on this page will be cleared. Saved plans and workouts are not affected.', confirm: 'Clear and go to Today', cancel: 'Keep going' },
} as const;

/** 重新制定计划 starts the questions from scratch. */
export const replanCopy = {
  zh: { title: '重新制定计划？', hint: '会清空上次填写的回答和还没确认的草案，从第一步重新开始。已经完成的训练记录和以前的计划都会保留。', confirm: '清空并重新开始', cancel: '取消' },
  en: { title: 'Make a new plan?', hint: 'Your previous answers and any unconfirmed draft will be cleared, and you start from the first question. Finished workouts and earlier plans are kept.', confirm: 'Clear and start over', cancel: 'Cancel' },
} as const;

/** Birth year and month: tap a month on a year page, or type it. */
export const birthPickerCopy = {
  zh: { pick: '点选', manual: '手动输入', mode: '输入方式', prevYear: '上一年', nextYear: '下一年', years: '选年份', prevYears: '往前 12 年', nextYears: '往后 12 年',
    month: '{month} 月', chosen: '已选 {year} 年 {month} 月', none: '还没选', yearUnit: '{year} 年' },
  en: { pick: 'Tap to pick', manual: 'Type it', mode: 'Input method', prevYear: 'Previous year', nextYear: 'Next year', years: 'Pick a year', prevYears: '12 years earlier', nextYears: '12 years later',
    month: '{month}', chosen: 'Picked {month} {year}', none: 'Not picked yet', yearUnit: '{year}' },
} as const;
