/** 营养建议: AI conversation about everyday food and drink, plus local food records. */
export const nutritionAdviceCopy = {
  zh: {
    title: '营养建议', back: '返回', intro: '练前练后吃什么、喝多少水、外食怎么选，都可以问芽芽。',
    chatTitle: '问问芽芽', scope: '只谈日常饮食，不做诊断，不给节食方案', input: '想问什么吃的、喝的？', send: '发送', stop: '停止', you: '你', yaya: '芽芽',
    privacy: '只发送你在这里写的话，不发送身体资料、训练记录和饮食记录。对话不保存在设备上，离开页面就清空。',
    prompts: ['练完吃什么比较好', '一天喝多少水合适', '外卖怎么选'], quick: '常用的话', fresh: '新对话',
    unavailable: '现在用不了 AI 对话', activate: '开通 AI', records: '饮食记录', recordsHint: '记录只保存在这台设备。',
    more: '以后这里还会有更多饮食功能。',
  },
  en: {
    title: 'Nutrition advice', back: 'Back', intro: 'Ask Yaya what to eat before or after training, how much to drink, or how to choose when eating out.',
    chatTitle: 'Ask Yaya', scope: 'Everyday eating only. No diagnosis or diet plans', input: 'What would you like to ask about food or drinks?', send: 'Send', stop: 'Stop', you: 'You', yaya: 'Yaya',
    privacy: 'Only what you write here is sent. Body details, training and food records are not. The conversation is not saved on this device and clears when you leave.',
    prompts: ['What should I eat after training', 'How much water a day', 'Choosing takeaway food'], quick: 'Quick questions', fresh: 'New conversation',
    unavailable: 'AI chat is not available right now', activate: 'Turn on AI', records: 'Food records', recordsHint: 'Records stay on this device.',
    more: 'More food features will come here later.',
  },
} as const;
