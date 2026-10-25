/**
 * 芽芽's plan tips approved by Bo on 2026-10-25: 上周小结 · 下周怎么调 (G) and the monthly goal check (K).
 * zh is verbatim from the approved drafts; {placeholders} are filled from saved data only.
 * `summary` lines are written into the new plan version's change note.
 */
export const yayaTips = {
  zh: {
    // G · 上周小结加“下周怎么调”
    pain: '上周记下过{area}不舒服。下周继续用替代动作，{area}相关的动作先不加量。如果疼痛明显或持续，先休息，并请专业人士看看。',
    painOk: '知道了',
    painSwaps: '看替代动作',
    zero: '下周目标先改成 1 次、每次 20 分钟，练上了再加回来？🌱',
    weekday: '没练上的那次在{weekday}，前一周也是。下周{weekday}换成 20 分钟短练？🧠',
    short: '上周每次平均 {actual} 分钟，比计划短 {gap} 分钟。下周每次改成 {minutes} 分钟的版本？📊',
    overdone: '上周多练了 {extra} 次，身体也跟得上。想把目标改成每周 {next} 次吗？📊',
    overdoneYes: '改成 {next} 次',
    overdoneNo: '保持 {target} 次',
    onTrack: '下周照这个节奏就好 😌',
    adjust: '就这样调整',
    notNow: '先不改',
    areas: { knee: '膝盖', back: '腰背', shoulder: '肩膀', wrist: '手腕', other: '身体' },
    areaJoin: '、',
    weekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    // K · 每月问一次“目标还是这个吗”
    goalAsk: '一个月了。你一开始说想{goal}，现在还是最想要这个吗？🎯',
    goalAskLess: '最近练得少，可能是计划和生活还没对上，不一定是目标的问题。{goal}，现在还想要吗？🌱',
    goalAskNone: '一个月了。现在你最想通过运动得到什么？🎯',
    goalKeep: '还是这个',
    goalKeepLess: '还想要',
    goalChange: '想换一个',
    goalKept: '好，接着按这个来 😌',
    goalChanged: '我按新目标重新排一下计划。旧计划会留着，随时能换回来 📊',
    goalSeePlan: '看看新计划',
    goalNotNow: '先不改',
    goalOwnPlaceholder: '比如：爬山不喘',
    goalOwnSave: '就这个',
    close: '关闭',
    // Change notes saved with the new plan version
    summary: {
      zero: '每周目标从 {target} 次改为 1 次，每次 20 分钟',
      weekday: '{weekday}改为 {minutes} 分钟短练',
      short: '每次改为 {minutes} 分钟',
      overdone: '每周目标从 {target} 次改为 {next} 次',
      gap: '今天的训练给{group}加 {sets} 组',
      pushPull: '今天的训练加一组划船',
    },
  },
  en: {
    pain: "You noted {area} discomfort last week. Next week we'll keep the swaps and hold the load on {area} moves. If the pain is strong or keeps going, rest first and have a professional take a look.",
    painOk: 'Got it',
    painSwaps: 'See swaps',
    zero: "Next week, set the goal to one 20-minute session and add the rest back once it's done? 🌱",
    weekday:
      'The missed session was on {weekday}, same as the week before. Make {weekday} a 20-minute short session next week? 🧠',
    short:
      'Your sessions averaged {actual} min last week, {gap} min under plan. Switch next week to {minutes}-minute sessions? 📊',
    overdone: 'You did {extra} more than planned and recovered fine. Raise the goal to {next} a week? 📊',
    overdoneYes: 'Make it {next}',
    overdoneNo: 'Keep {target}',
    onTrack: 'Same rhythm next week 😌',
    adjust: 'Adjust it',
    notNow: 'Not now',
    areas: { knee: 'knee', back: 'back', shoulder: 'shoulder', wrist: 'wrist', other: 'body' },
    areaJoin: ' and ',
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    goalAsk: "It's been a month. You started out wanting to {goal}. Is that still what you want most? 🎯",
    goalAskLess:
      "You've trained less lately. That's usually the plan not fitting your life, not the goal. Do you still want to {goal}? 🌱",
    goalAskNone: "It's been a month. What do you most want from exercise right now? 🎯",
    goalKeep: 'Still this',
    goalKeepLess: 'Still want it',
    goalChange: 'Change it',
    goalKept: "Good, we'll keep going with this 😌",
    goalChanged: "I'll rework the plan around the new goal. The old one stays, so you can switch back anytime 📊",
    goalSeePlan: 'See the new plan',
    goalNotNow: 'Not now',
    goalOwnPlaceholder: 'e.g. climb hills without getting winded',
    goalOwnSave: 'Use this',
    close: 'Close',
    summary: {
      zero: 'Weekly goal from {target} to 1, 20 minutes each',
      weekday: '{weekday} is now a {minutes}-minute short session',
      short: 'Sessions are now {minutes} minutes',
      overdone: 'Weekly goal from {target} to {next}',
      gap: "Added {sets} {group} sets to today's session",
      pushPull: "Added a set of rows to today's session",
    },
  },
} as const;

/** The pain line is a safety line: no emoji (checkSafetyLanguage). */
export const yayaTipSafetyKeys = ['pain'] as const;

/** “想瘦下来” → “瘦下来” after “你一开始说想”; “I’d like to lose weight” → “lose weight” after “wanting to”. Long goals are cut at 40. */
export function goalPhrase(goal: string, locale: 'zh' | 'en', strip = true): string {
  const text = goal.trim(),
    cut = text.length > 40 ? `${text.slice(0, 40)}…` : text;
  if (!strip) return cut;
  if (locale === 'zh') return cut.replace(/^想/, '');
  const bare = cut.replace(/^(I[’']d like to|I[’']d like|I want to|I want)\s+/i, '');
  return bare.charAt(0).toLowerCase() + bare.slice(1);
}
