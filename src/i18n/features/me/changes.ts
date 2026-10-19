/** 我的 › 我的变化: trends from local records only. Lines never state facts the app does not have. */
export const changesCopy = {
  zh: {
    title: '我的变化', back: '返回我的', local: '只用这台设备上的记录，不会发送。',
    weight: '体重', bodyFat: '体脂', strength: '力量', sessions: '训练次数', kg: '公斤', percent: '%', times: '次',
    change: '{from} → {to}', since: '从 {date} 起', noChange: '只有一次记录，再记一次就能看到变化。',
    emptyBody: '还没有体重或体脂记录。记一次，以后就能看到变化。', emptyFat: '还没有体脂记录，可以在下面一起记。',
    emptyStrength: '还没有带重量的训练记录。练过有重量的动作后，这里会显示估算的最大力量。', strengthHint: '按每组重量和次数估算的单次最大重量（1–12 次的组），只作参考。',
    add: '记一次身体数据', addTitle: '记一次身体数据', date: '日期', weightLabel: '体重（公斤）', fatLabel: '体脂率（%，可选）', save: '保存', cancel: '取消',
    saved: '已记下', invalid: '体重 20–300 公斤，体脂 3–70%。', sameDay: '这一天已经记过，保存会更新那一条。',
    month: '这个月和上个月', thisMonth: '这个月', lastMonth: '上个月', monthSessions: '练了 {count} 次', monthMinutes: '约 {count} 分钟', monthSets: '{count} 组',
    monthWeight: '体重变化 {value} 公斤', review: '看完整回顾', monthReview: '看月度回顾', summaryCard: '这个月练了 {count} 次，上个月 {previous} 次。',
    perMonth: '最近 6 个月每月训练次数',
  },
  en: {
    title: 'My changes', back: 'Back to Me', local: 'Uses records on this device only. Nothing is sent.',
    weight: 'Weight', bodyFat: 'Body fat', strength: 'Strength', sessions: 'Sessions', kg: 'kg', percent: '%', times: '',
    change: '{from} → {to}', since: 'since {date}', noChange: 'Only one record so far. Add another to see a change.',
    emptyBody: 'No weight or body fat records yet. Add one and changes will show here.', emptyFat: 'No body fat records yet. You can add one below.',
    emptyStrength: 'No weighted sets yet. After you train with weights, an estimated one-rep max shows here.', strengthHint: 'Estimated single-rep max from each set’s load and reps (sets of 1–12 reps). For reference only.',
    add: 'Add a body measurement', addTitle: 'Add a body measurement', date: 'Date', weightLabel: 'Weight (kg)', fatLabel: 'Body fat (%, optional)', save: 'Save', cancel: 'Cancel',
    saved: 'Saved', invalid: 'Weight 20–300 kg, body fat 3–70%.', sameDay: 'This day already has a record. Saving updates it.',
    month: 'This month and last month', thisMonth: 'This month', lastMonth: 'Last month', monthSessions: '{count} sessions', monthMinutes: 'about {count} min', monthSets: '{count} sets',
    monthWeight: 'Weight change {value} kg', review: 'See the full review', monthReview: 'See monthly review', summaryCard: '{count} sessions this month, {previous} last month.',
    perMonth: 'Sessions per month, last 6 months',
  },
} as const;
