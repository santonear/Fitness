/** UI labels for the training-plan upgrade pages (UIUX20261008 V9.14). 芽芽's sentences live in coach/yaya-v5.ts. */
export const planPagesCopy = {
  zh: {
    // Home
    variantLabel: '今天的方案', variant: { standard: '标准', tired: '累了', 'no-equipment': '没器械' },
    sceneLabel: '碎片时间', scene: { commute: '通勤', office: '办公室', bedtime: '睡前' },
    intentionLabel: '我练的时间和地点', intentionPlaceholder: '比如：周二下班后，客厅', intentionSave: '记下', intentionEdit: '改一下',
    calm: '现在有点烦', journey: '我的山路',
    // Settings › 训练设置
    panelStyle: '首页面板样式', panelStyles: { hero: '大数字', ring: '肌群环', twin: '双表盘' },
    showOutline: '显示体型轮廓', voice: '语音播报', voiceHint: '只用本机语音，不联网', voiceUnavailable: '这台设备没有本机语音',
    // 今天练这里
    focusTitle: '今天练这里', primary: '主练', secondary: '辅助', start: '开始 · {minutes}′', male: '男', female: '女', sexLabel: '体型',
    back: '返回',
    // 我的山路
    journeyTitle: '我的山路', now: '现在', before: '{month}', outlineNote: '轮廓按身高体重估算，仅作示意',
    recordWeight: '记今天的体重', weightLabel: '今天的体重（kg）', save: '保存', cancel: '取消', weightInvalid: '请填 20 到 300 之间的数字',
    weightSince: '比 {month}', heightCm: '{cm} cm', kg: 'kg',
    stopStart: '起点', stopNow: '现在', destination: '终点',
    testTitle: '体能小测', testItems: { pushup: '俯卧撑（女性可跪姿）', situp60s: '1 分钟仰卧起坐', sitAndReachCm: '坐位体前屈（cm）', singleLegStandEyesClosedS: '闭眼单脚站（秒）', chairStand30s: '30 秒坐站' },
    testUnits: { pushup: '个', situp60s: '个', sitAndReachCm: 'cm', singleLegStandEyesClosedS: '秒', chairStand30s: '个' },
    testSave: '记下成绩', bodyAge: '身体年龄', estimated: '估算', years: '{years} 岁',
    letterTitle: '给未来的自己', letterPlaceholder: '写给半年后的自己', letterSave: '收好', letterSaved: '收好了，到营地时再打开。', letterOpenButton: '打开',
    meetTitle: '先认识一下', routeLabel: '选一条路线', routes: { health: '健康', shape: '塑形', postpartum: '产后恢复' },
    postpartumCheck: '产后恢复先做一次产后安全自查。', postpartumCheckGo: '去自查',
    meetSave: '出发', next: '下一步', yourWords: '用你自己的话写',
    // 现在有点烦
    calmTitle: '慢慢呼吸', inhale: '吸气', exhale: '呼气', calmDone: '结束', calmMinutes: '{minutes} 分钟',
    whyLabel: '为什么', evidence: { strong: '证据扎实', moderate: '中等把握' },
  },
  en: {
    variantLabel: "Today's option", variant: { standard: 'Standard', tired: 'Tired', 'no-equipment': 'No equipment' },
    sceneLabel: 'Spare moments', scene: { commute: 'Commute', office: 'Office', bedtime: 'Bedtime' },
    intentionLabel: 'When and where I train', intentionPlaceholder: 'e.g. Tuesday after work, living room', intentionSave: 'Save', intentionEdit: 'Edit',
    calm: 'Feeling a bit on edge', journey: 'My trail',
    panelStyle: 'Home panel style', panelStyles: { hero: 'Big number', ring: 'Muscle ring', twin: 'Twin dials' },
    showOutline: 'Show body outline', voice: 'Voice cues', voiceHint: 'Uses on-device voices only, no network', voiceUnavailable: 'No on-device voice on this device',
    focusTitle: 'Today you train', primary: 'Main', secondary: 'Support', start: 'Start · {minutes}′', male: 'Male', female: 'Female', sexLabel: 'Figure',
    back: 'Back',
    journeyTitle: 'My trail', now: 'Now', before: '{month}', outlineNote: 'The outline is estimated from height and weight, for illustration only',
    recordWeight: "Log today's weight", weightLabel: "Today's weight (kg)", save: 'Save', cancel: 'Cancel', weightInvalid: 'Enter a number from 20 to 300',
    weightSince: 'vs {month}', heightCm: '{cm} cm', kg: 'kg',
    stopStart: 'Start', stopNow: 'Now', destination: 'Destination',
    testTitle: 'Fitness mini-test', testItems: { pushup: 'Push-ups (kneeling for women)', situp60s: '1-minute sit-ups', sitAndReachCm: 'Sit and reach (cm)', singleLegStandEyesClosedS: 'One-leg stand, eyes closed (s)', chairStand30s: '30-second chair stand' },
    testUnits: { pushup: '', situp60s: '', sitAndReachCm: 'cm', singleLegStandEyesClosedS: 's', chairStand30s: '' },
    testSave: 'Save results', bodyAge: 'Body age', estimated: 'estimate', years: '{years}',
    letterTitle: 'To my future self', letterPlaceholder: 'Write to yourself six months from now', letterSave: 'Keep it', letterSaved: 'Kept. It opens when you reach the camp.', letterOpenButton: 'Open',
    meetTitle: 'Getting to know you', routeLabel: 'Choose a route', routes: { health: 'Health', shape: 'Shape', postpartum: 'Postpartum recovery' },
    postpartumCheck: 'Postpartum recovery starts with a postpartum safety check.', postpartumCheckGo: 'Do the check',
    meetSave: 'Set out', next: 'Next', yourWords: 'In your own words',
    calmTitle: 'Slow breathing', inhale: 'Breathe in', exhale: 'Breathe out', calmDone: 'End', calmMinutes: '{minutes} min',
    whyLabel: 'Why', evidence: { strong: 'Strong evidence', moderate: 'Moderate confidence' },
  },
} as const;
