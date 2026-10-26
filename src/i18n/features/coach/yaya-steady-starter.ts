/**
 * 芽芽 lines and labels for the 稳健 route (H) and 新手 4 周 (J), approved by Bo on 2026-10-25
 * (brief: approved-wording-6-7-H-J). zh is verbatim; en is the approved translation.
 * Keys in `steadyStarterSafetyKeys` are safety lines: no emoji (checkSafetyLanguage).
 */
export const steadyStarterCopy = {
  zh: {
    // H 稳健
    routeSub: '腿有劲、站得稳、走得远',
    steadyIntro: '我会按 60 岁以上的安全要求来排：每次都有平衡练习，不安排跳跃和需要趴下再起来的动作 🌱',
    steadyFalls: '先问 4 个关于走路和平衡的小问题，这样我排的动作会更稳 🧠',
    steadyToday: '今天练腿力和平衡，大约 {minutes} 分钟 🌱',
    steadyChair: '旁边放一把结实的椅子，需要的时候扶一下。',
    steadyBalance: '扶椅单脚站，从 {a} 秒到现在 {b} 秒了 📈',
    steadyChairStand: '30 秒站起来 {n} 次，比上次多 {d} 次 📈',
    steadyWeek4: '练了 4 周了。腿的力气一般这时候开始变化，上下楼时可以留意一下 😌',
    steadyWeek8: '8 周了。单脚站和起身这些动作，可以留意一下是不是比刚开始稳了 📈',
    steadyWeek12: '12 周练完了。做一次小测，看看和刚开始比怎么样 🎯',
    steadyMissed: '这周没练上，没关系。下次从轻一点的开始 🌱',
    // J 新手 4 周
    starterTitle: '新手 4 周',
    starterOffer: '刚开始练？试试新手 4 周：每周 2–3 次，每次 20–30 分钟，先学会基本动作，把习惯养起来 🌱',
    starterUse: '用新手 4 周',
    starterOwn: '自己排',
    starterHonest: '4 周能学会动作、力量开始涨，体型变化通常要更久 📊',
    starterProgress: '第 {n} 周 / 共 4 周',
    starterWeeks: [
      '第 1 周 · 先熟悉动作。这周两次，每个动作做轻一点，把姿势做对 🌱',
      '第 2 周 · 找到节奏。上周练了 {n} 次，这周节奏不变，动作熟一点就好 😌',
      '第 3 周 · 加一点量。每个动作多 1 组，还是留 2–3 次的余力 📈',
      '第 4 周 · 轻一点，做个小测。量减一点让身体缓一缓，这周找一天测一下 🎯',
    ],
    starterMissed: '上周没练上，没关系。接着练第 {n} 周的内容，不用补 🌱',
    starterQuit: '退出',
    starterQuitAsk: '退出新手 4 周？练过的记录都会保留，计划回到按天安排。',
    starterQuitYes: '退出',
    starterQuitNo: '继续练',
    starterQuitDone: '好，已经退出了。想再试的时候，在计划页可以重新开始 😌',
    starterDone: '4 周完成了，一共练了 {n} 次。{item}从 {a} 到 {b} 📈',
    /** The same line when no test can be compared yet: facts only, nothing made up. */
    starterDoneCount: '4 周完成了，一共练了 {n} 次。',
    starterKeep: '接着练',
    starterChange: '换个目标',
    // Plan version history entries
    starterStarted: '开始新手 4 周',
    starterLeft: '退出新手 4 周',
    starterFinished: '完成新手 4 周',
  },
  en: {
    routeSub: 'Strong legs, steady balance, longer walks',
    steadyIntro:
      "I'll plan to the safety guidance for people over 60: balance work every session, no jumping, and nothing that needs getting down to the floor and back up 🌱",
    steadyFalls: 'First, 4 quick questions about walking and balance, so the moves I pick feel steady 🧠',
    steadyToday: 'Today: leg strength and balance, about {minutes} min 🌱',
    steadyChair: 'Keep a sturdy chair next to you to hold when you need it.',
    steadyBalance: 'Single-leg stand at the chair: from {a} s to {b} s 📈',
    steadyChairStand: '{n} stands in 30 seconds, {d} more than last time 📈',
    steadyWeek4: 'Four weeks in. Leg strength often starts to change around now. Notice it on the stairs 😌',
    steadyWeek8:
      'Eight weeks in. Notice whether standing on one leg and getting up feel steadier than when you started 📈',
    steadyWeek12: 'Twelve weeks done. Take the quick test and compare with where you started 🎯',
    steadyMissed: "Missed this week, that's fine. Next time we'll start a little lighter 🌱",
    starterTitle: 'Starter 4 Weeks',
    starterOffer:
      'New to this? Try Starter 4 Weeks: 2–3 sessions a week, 20–30 minutes each, to learn the basics and build the habit 🌱',
    starterUse: 'Try Starter 4 Weeks',
    starterOwn: "I'll plan my own",
    starterHonest:
      'Four weeks is enough to learn the moves and start getting stronger. Changes in shape usually take longer 📊',
    starterProgress: 'Week {n} of 4',
    starterWeeks: [
      'Week 1 · Learn the moves. Two sessions, keep it light, focus on form 🌱',
      'Week 2 · Find your rhythm. You did {n} last week. Same pace, just smoother 😌',
      'Week 3 · A bit more. One extra set per move, still 2–3 reps in reserve 📈',
      'Week 4 · Ease off and test. Lighter week to recover; pick a day for the quick test 🎯',
    ],
    starterMissed: "Missed last week, that's fine. Pick up with week {n}, no catching up needed 🌱",
    starterQuit: 'Leave',
    starterQuitAsk: 'Leave Starter 4 Weeks? Your records stay, and your plan goes back to day-by-day.',
    starterQuitYes: 'Leave',
    starterQuitNo: 'Keep going',
    starterQuitDone: 'Done. You can start it again from the Plan page anytime 😌',
    starterDone: 'Four weeks done: {n} sessions. {item} went from {a} to {b} 📈',
    starterDoneCount: 'Four weeks done: {n} sessions.',
    starterKeep: 'Keep training',
    starterChange: 'Change goal',
    starterStarted: 'Started Starter 4 Weeks',
    starterLeft: 'Left Starter 4 Weeks',
    starterFinished: 'Finished Starter 4 Weeks',
  },
} as const;

/** Safety lines: checked with checkSafetyLanguage (no emoji). */
export const steadyStarterSafetyKeys = ['steadyChair'] as const;
