export default {
title: '我的计划', versions: '计划版本', goal: '目标', rhythm: '节奏',
    history: '查看以前的版本', library: '动作库', chat: '和芽芽聊聊怎么调整',
    back: '返回', current: '当前', readOnly: '只读', view: '查看计划',
    historyNote: '每次调整都存成新版本。已完成的训练记录始终对应当时的版本。',
    version: (n: number) => `第 ${n} 版`, pace: (n: number) => `每周 ${n} 次，时间随你`,
    minutes: (n: number) => `${n} 分钟`, sets: (n: number) => `${n} 组`,
    reps: (n: number) => `${n} 次`, seconds: (n: number) => `${n} 秒`,
    kg: (n: number) => `${n} 千克`, meters: (n: number) => `${n} 米`,
    origins: { onboard: '和芽芽一起制定', coach_change: '和芽芽一起调整', review_suggestion: '采纳本周建议', manual: '手动调整', migrated: '从以前的计划保留' },
  };

