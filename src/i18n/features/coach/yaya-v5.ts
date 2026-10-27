/**
 * 芽芽话术 v5 (docs/design/plan-upgrade/yaya-wording-v5.md, UIUX20261008 V9.14 and part 2 §7.2).
 * zh is verbatim from v5; numbers in v5 examples became {placeholders}. en is the matching translation.
 * Keys listed in `yayaSafetyKeys` are safety, pain, medical or low-mood lines: no emoji (checkSafetyLanguage).
 */
export const yayaV5 = {
  zh: {
    // §1 漏练后回来
    returnHello: '嘿，你回来啦。今天随便动个 10 分钟，就当跟身体打个招呼吧 🌱',
    returnHelloGo: '来吧',
    returnHelloLater: '晚点再说',
    returnEasy: '我看了下，身体的底子还在。今天先轻松练一次，找回感觉就行 😌',
    returnEasyGo: '好',
    returnEasyFull: '我想练完整的',
    // §2 只练了一部分 / 状态不好
    partialDone: '练了 {sets} 组，已经记进本周数据了，今天收工 📊',
    lowState: '我看你今天的状态分有点低，换个 10 分钟轻松版？硬撑不划算 ☕',
    lowStateEasy: '换轻松的',
    lowStateOk: '我还行',
    // §3 初见三问
    meetIntro: '给我 30 秒，我需要先了解你，才能把计划算准 🧠',
    meetWhy: '是什么让你想动起来的？',
    meetWhyOptions: ['想睡个好觉', '腰背舒服点', '精神好一点', '身材更好看', '说不清，就想动动'],
    meetChange: '如果坚持下来，你最希望生活里哪件事变得不一样？',
    meetBefore: '以前有没有试过然后没继续？是被什么绊住了？',
    meetBeforeOptions: ['太忙', '太累', '不知道练啥', '受过伤', '没有过'],
    // §4 现在有多少时间
    nowAsk: '你现在有多少时间？',
    nowFill: '我算了一下，{minutes} 分钟刚好把{group}这 {sets} 组补上 🎯',
    nowFive: '5 分钟也有用，我挑了 {count} 个最划算的动作 ⚡',
    // §5 B 计划
    bPlan: '我给今天备了两套方案：累了走轻松版，没器械走徒手版，数据都照算 📊',
    // §6 碎片模式
    fragmentStairs: '等电梯那会儿，走楼梯上两层，我会把它算进今天的活动量 ⚡',
    fragmentHonest: '说实话，零碎练对健康很有用，但想练出线条，每周还得有两次完整训练 📊',
    // §7 执行意图
    intentionAsk: '你一般什么时候、在哪儿最可能练？我按这个来排计划 🎯',
    // §8 肌群图
    scanGap: '扫描完了：这周练得挺全，就是{group}还差 {sets} 组。要不要现在补上？🎯',
    scanGapYes: '补上',
    scanGapNo: '下次吧',
    scanPushPull: '我发现你推的动作比拉的多不少，加一组划船，帮肩膀找平衡？📊',
    scanPushPullYes: '加',
    scanPushPullNo: '不用',
    // §9 个人纪录
    recordNew: '等等，{exercise} {kg} 公斤做了 {reps} 个，新纪录 📈',
    recordMonth: '跟一个月前比，你多了 {kg} 公斤。曲线在往上走 📈',
    // §10 体能指纹与身体年龄
    testAsk: '来做个 1 分钟小测，我更新一下你的体能指纹 📊',
    testNow: '现在测',
    testLater: '下次',
    testUp: '{item}从 {from}涨到 {to}。按这个成绩估算，你的身体年龄大概是 {age} 岁，比实际年轻 {younger} 岁 📈',
    testAge: '按这个成绩估算，你的身体年龄大概是 {age} 岁 📈',
    testWeak: '我看了下五边形，{item}是现在的短板，这周帮你加了 2 次拉伸 ⚡',
    testDown: '这次少了 {count} 个，可能最近没睡好，波动很正常。下周再测一次，看趋势就好 📊',
    // §12 给未来的自己
    letterAsk: '给半年后的自己留句话吧，等你到营地的时候，我再拿出来给你看 💌',
    letterOpen: '还记得出发那天你写的这句话吗？💌',
    // §13 现在有点烦
    calmStart: '先别管训练了，跟着我慢慢吸气，再慢慢呼气，就 3 分钟 😌',
    calmAsk: '现在感觉怎么样？',
    calmBetter: '好点了',
    calmSame: '差不多',
    calmStill: '还是很烦',
    calmStillLine: '那今天就别勉强了，好好休息。要是一直这样，找个信得过的人聊聊会好受些。',
    // §14 放弃规律
    skipDay: '我看了下记录，最近 3 个{weekday}你都没练上。{weekday}改成 10 分钟短练？🧠',
    skipDayYes: '改吧',
    skipDayNo: '不用',
    // §15 提醒自我收敛
    reminderUnused: '这个时间的提醒最近都没用上，我猜时间不太对。换个时间，还是先关掉？',
    reminderMove: '换时间',
    reminderOff: '关掉吧',
    // §16 证据标签
    evidenceStrength: '一周练两次力量，是世卫组织的推荐，证据很扎实 📊',
    evidenceFragment: '零碎运动对健康有好处，研究还在继续，算中等把握 📊',
    // §17 康复路线安全提示
    rehabAsk: '开始前我得先问一句：最近有没有夜里疼醒、发麻没力气、或者又红又肿的情况？',
    rehabYes: '有',
    rehabNo: '没有',
    rehabStop: '那咱们先别练了，找医生看看更放心。今天就做点轻松的活动。',
    painLine: '疼的话就换个轻一点的动作。要是一直疼或者疼得明显，先歇着，找专业的人看看。',
    // §19 身体变化
    strongerLift: '我看了下，{exercise}比一个月前多了 {kg}kg。你是真的变强了 💪',
    strongerTest: '{item}从 {from}到 {to}，这可不是运气 📊',
    lighter: '这两周平均轻了 {kg}kg，轮廓也收了一点 🎯',
    waist: '腰围比 {month} 少了 {cm}cm，你的努力看得见 📊',
    feelSleep: '你说最近睡得更好了，这比体重上的任何数字都重要 🌱',
    careFast: '最近体重掉得有点快，吃饱睡好了吗？慢一点更稳，也更不容易反弹。',
    careLowBmi: '现在的体重已经在健康范围的下边了，接下来我们把重点放在力量上。',
    // 瑜伽 (Bo 2026-10-27 approved).
    yogaDraft: '这份按瑜伽来排：每次从静心开始，到摊尸式放松结束。每个体式点一下开始，跟着呼吸来就好。🌱',
    yogaStrength: '每周练 3 天以上，我加了 {count} 天全身力量，让瑜伽里的支撑更稳。',
    yogaToday: '今天的瑜伽课约 {minutes} 分钟，跟着顺序慢慢来，最后躺下放松。',
    yogaDone: '完成了。这是你本周第 {count} 次瑜伽。😌',
    yogaPose: '这个体式今天先跳过，换成婴儿式歇一下。如果疼痛明显或持续，先休息，并请专业人士看看。',
    yogaWeek: '这周练了 {count} 次瑜伽，共 {minutes} 分钟。',
    yogaWeekSteady: '节奏在慢慢稳下来。',
    yogaWeekPartial: '第 {number} 次后半段没练上，下次可以练到{stage}就收尾。',
  },
  en: {
    returnHello: "Hey, you're back. Move for 10 minutes today, just to say hi to your body 🌱",
    returnHelloGo: "Let's go",
    returnHelloLater: 'Later',
    returnEasy: 'I had a look: your base is still there. Do one easy session today to get the feel back 😌',
    returnEasyGo: 'OK',
    returnEasyFull: 'I want the full one',
    partialDone: '{sets} sets done and counted in this week. That is it for today 📊',
    lowState: 'Your check-in looks low today. Switch to an easy 10-minute version? Pushing through is not worth it ☕',
    lowStateEasy: 'Go easy',
    lowStateOk: "I'm fine",
    meetIntro: 'Give me 30 seconds. I need to get to know you to work out the right plan 🧠',
    meetWhy: 'What made you want to get moving?',
    meetWhyOptions: ['Sleep better', 'An easier back', 'More energy', 'A better shape', 'Not sure, just want to move'],
    meetChange: 'If you keep it up, what one thing in your life would you most like to change?',
    meetBefore: 'Have you tried before and stopped? What got in the way?',
    meetBeforeOptions: ['Too busy', 'Too tired', "Didn't know what to do", 'An injury', 'Never tried'],
    nowAsk: 'How much time do you have now?',
    nowFill: 'I worked it out: {minutes} minutes is just right for the {sets} {group} sets still open 🎯',
    nowFive: 'Five minutes still counts. I picked the {count} moves that give the most ⚡',
    bPlan:
      'I have two backups for today: tired takes the easy one, no equipment takes the bodyweight one. Both count the same 📊',
    fragmentStairs: 'While you wait for the lift, take two flights of stairs. I will count it in today’s activity ⚡',
    fragmentHonest:
      'Honestly, short bits are great for health, but for visible definition you still need two full sessions a week 📊',
    intentionAsk: 'When and where are you most likely to train? I will plan around that 🎯',
    scanGap: 'Scan done: a well-rounded week, only {group} is {sets} sets short. Fill it now? 🎯',
    scanGapYes: 'Fill it',
    scanGapNo: 'Next time',
    scanPushPull: 'You push a lot more than you pull. Add a set of rows to balance your shoulders? 📊',
    scanPushPullYes: 'Add',
    scanPushPullNo: 'No thanks',
    recordNew: 'Wait: {exercise} {kg} kg for {reps} reps, a new record 📈',
    recordMonth: 'Compared with a month ago you added {kg} kg. The curve is going up 📈',
    testAsk: 'Take a 1-minute test so I can update your fitness fingerprint 📊',
    testNow: 'Test now',
    testLater: 'Next time',
    testUp:
      '{item} went from {from} to {to}. From these results your body age is estimated at about {age}, {younger} years younger than your actual age 📈',
    testAge: 'From these results your body age is estimated at about {age} 📈',
    testWeak: 'Looking at the pentagon, {item} is your weak spot now, so I added 2 stretching sessions this week ⚡',
    testDown:
      '{count} fewer this time, maybe sleep was short lately. Ups and downs are normal; test again next week and watch the trend 📊',
    letterAsk: 'Leave a note for yourself six months from now. When you reach the camp, I will show it to you 💌',
    letterOpen: 'Remember what you wrote on the day you set out? 💌',
    calmStart: 'Forget training for now. Breathe in slowly with me, then out slowly, just 3 minutes 😌',
    calmAsk: 'How do you feel now?',
    calmBetter: 'A bit better',
    calmSame: 'About the same',
    calmStill: 'Still upset',
    calmStillLine:
      "Then don't push it today; rest well. If it keeps feeling like this, talking to someone you trust can help.",
    skipDay: 'I checked: you missed the last 3 {weekday}s. Make {weekday} a 10-minute short session? 🧠',
    skipDayYes: 'Change it',
    skipDayNo: 'No thanks',
    reminderUnused:
      "Reminders at this time haven't been used lately; maybe the time is off. Change the time, or turn them off for now?",
    reminderMove: 'Change time',
    reminderOff: 'Turn off',
    evidenceStrength: 'Strength training twice a week is a WHO recommendation, with solid evidence 📊',
    evidenceFragment: 'Short bouts of activity are good for health; research is ongoing, so moderate confidence 📊',
    rehabAsk:
      'Before we start I need to ask: lately, any pain that wakes you at night, numbness or weakness, or redness and swelling?',
    rehabYes: 'Yes',
    rehabNo: 'No',
    rehabStop: "Then let's not train for now; seeing a doctor is the safer call. Do some light activity today.",
    painLine:
      'If it hurts, switch to a lighter move. If the pain keeps up or is clear, rest first and have a professional take a look.',
    strongerLift: 'I had a look: {exercise} is up {kg} kg on a month ago. You really have got stronger 💪',
    strongerTest: '{item} from {from} to {to}. That is not luck 📊',
    lighter: 'Over the last two weeks your average is {kg} kg lower and the outline eased a little 🎯',
    waist: 'Waist {cm} cm smaller than in {month}. Your work shows 📊',
    feelSleep: 'You said you sleep better lately. That matters more than any number on the scale 🌱',
    careFast:
      'Your weight has been dropping a bit fast. Are you eating and sleeping enough? Slower is steadier and less likely to bounce back.',
    careLowBmi: "Your weight is now at the lower edge of the healthy range, so next we'll focus on strength.",
    yogaDraft:
      'This plan is built as yoga: each session starts by settling in and ends resting in Corpse Pose. Tap to start each pose and follow your breath 🌱',
    yogaStrength:
      'You train 3 or more days a week, so I added {count} full-body strength day(s) to steady your yoga poses.',
    yogaToday:
      "Today's yoga session is about {minutes} minutes. Take it in order, slowly, and lie down to rest at the end.",
    yogaDone: 'Done. That is yoga session {count} this week 😌',
    yogaPose:
      'Skip this pose today and rest in Child’s Pose instead. If the pain is clear or keeps up, rest first and have a professional take a look.',
    yogaWeek: 'This week: {count} yoga sessions, {minutes} minutes in all.',
    yogaWeekSteady: 'Your rhythm is settling in.',
    yogaWeekPartial: 'Session {number} stopped before its second half; next time you can end after {stage}.',
  },
} as const;

export type YayaV5Key = keyof typeof yayaV5.zh;
/** Safety, pain, medical and low-mood lines: checked with checkSafetyLanguage (no emoji). */
export const yayaSafetyKeys = [
  'calmStillLine',
  'rehabAsk',
  'rehabStop',
  'painLine',
  'careFast',
  'careLowBmi',
  'yogaPose',
] as const satisfies readonly YayaV5Key[];

/** v5 §18 / §19: the same moment in each theme's voice. */
export const yayaThemeTone = {
  zh: {
    done: {
      pop: '练完啦，本周第 {count} 次 🎯',
      vivid: '今天这段路走完了，离营地又近一段 🏔️',
      gentle: '辛苦啦，今天能来练就很好了 🌱',
      data: '完成。本周 {count}/{target}。',
      fire: '拿下 🔥 本周 {count} 次',
    },
  },
  en: {
    done: {
      pop: 'Done, session {count} this week 🎯',
      vivid: "Today's stretch of trail is done, a little closer to camp 🏔️",
      gentle: 'Well done; showing up today is what counts 🌱',
      data: 'Done. This week {count}/{target}.',
      fire: 'Got it 🔥 {count} sessions this week',
    },
  },
} as const;

export const fillLine = (line: string, values: Record<string, string | number>) =>
  line.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

/** Yoga sequence stages by source position (week.day.yoga `yoga_<stage>_<n>`), for 芽芽's weekly line. */
export const yogaStageNames = {
  zh: {
    center: '静心',
    warm: '热身',
    sun: '拜日式',
    stand: '站立体式',
    balance: '平衡',
    core: '核心',
    arm: '手臂支撑',
    invert: '倒置',
    back: '后弯',
    twist: '扭转',
    hip: '开髋',
    fold: '前屈',
    supine: '仰卧',
  },
  en: {
    center: 'settling in',
    warm: 'the warm-up',
    sun: 'the sun salutation',
    stand: 'the standing poses',
    balance: 'the balances',
    core: 'the core work',
    arm: 'the arm balances',
    invert: 'the inversion',
    back: 'the backbends',
    twist: 'the twists',
    hip: 'the hip openers',
    fold: 'the forward folds',
    supine: 'the supine poses',
  },
} as const;
