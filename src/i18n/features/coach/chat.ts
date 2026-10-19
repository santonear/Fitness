/** V9 芽芽 chat header and quick replies. Quick replies only fill the composer; the user still sends. */
export const chatCopy = {
  zh: { scope: '只调整训练，不做诊断', quick: '常用的话', prompts: ['今天有点累', '只有 20 分钟', '换成在家练'],
    share: '发送哪些资料', tools: '快速调整', toolsTitle: '快速调整', activate: '开通 AI', guide: '看「{name}」怎么做', localOnly: '现在用的是本地建议' },
  en: { scope: 'Adjusts training only, no diagnosis', quick: 'Quick replies', prompts: ['I feel a bit tired today', 'I only have 20 minutes', 'Train at home instead'],
    share: 'What is shared', tools: 'Quick adjustments', toolsTitle: 'Quick adjustments', activate: 'Turn on AI', guide: 'How to do “{name}”', localOnly: 'Using local suggestions' },
} as const;
