/** 芽芽悬浮助手文案（docs/design/v9/Orb.dc.html 与各主题稿 OT 表）。 */
export const orbCopy = {
  zh: { orb: '芽芽助手，按住可上下拖动', title: '芽芽', close: '收起', closeTip: '收起提示', openChat: '打开对话', tuck: '靠边', panel: '芽芽快捷助手' },
  en: { orb: 'Yaya assistant, drag up or down to move', title: 'Yaya', close: 'Close', closeTip: 'Dismiss tip', openChat: 'Open chat', tuck: 'Tuck away', panel: 'Yaya quick help' },
} as const;

export type OrbContextId = 'home' | 'plan' | 'review' | 'settings' | 'finish' | 'other';
/** Default tip and quick actions per screen. Pages may pass data-aware tips instead; these never state user facts. */
export const orbContextCopy: Record<'zh' | 'en', Record<OrbContextId, { tip: string; actions: readonly string[] }>> = {
  zh: {
    home: { tip: '想先热身 5 分钟，还是直接开始？', actions: ['只有 20 分钟', '今天有点累', '换个地方练'] },
    plan: { tip: '想换训练日或缩短时间？点我直接改。', actions: ['换个训练日', '每次改成 20 分钟', '加一次有氧'] },
    review: { tip: '想看看最近练得怎么样？', actions: ['看看进步最大的动作', '帮我补上没练的', '下周怎么安排'] },
    settings: { tip: '换风格时，我也会跟着换装。', actions: ['推荐一个风格', '调整提醒时间', '修改身体情况'] },
    finish: { tip: '练得不错，要看看下次怎么加量吗？', actions: ['下次怎么加量', '今天哪里做得好', '明天该休息吗'] },
    other: { tip: '', actions: ['只有 20 分钟', '今天有点累', '换个地方练'] },
  },
  en: {
    home: { tip: 'Warm up for 5 minutes first, or start right away?', actions: ['I only have 20 minutes', 'I feel a bit tired today', 'Train somewhere else'] },
    plan: { tip: 'Want to move a training day or shorten sessions? Tap me.', actions: ['Move a training day', 'Make sessions 20 minutes', 'Add one cardio session'] },
    review: { tip: 'Want to see how your recent training went?', actions: ['Show my most improved exercise', 'Help me make up a missed session', 'Plan next week'] },
    settings: { tip: 'When you change the style, I change outfits too.', actions: ['Recommend a style', 'Change reminder time', 'Update my health details'] },
    finish: { tip: 'Nice work. Want to see how to progress next time?', actions: ['How to progress next time', 'What went well today', 'Should I rest tomorrow'] },
    other: { tip: '', actions: ['I only have 20 minutes', 'I feel a bit tired today', 'Train somewhere else'] },
  },
};
