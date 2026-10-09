export const adminCopy = {
  zh: {
    columns: ['称呼', '类型', '状态', '时间', '备注', '操作'],
    table: '申请审核', copy: '复制申请 ID', copied: '已复制完整 ID', copyFailed: '复制失败，请重试。',
    note: '处理说明', approve: '批准', reject: '拒绝', activate: '免邀请码直接开通',
    activated: '已免码激活，请用户在原申请浏览器刷新。',
    confirm: '立即开通30天？用户在原申请浏览器刷新即可使用，无需激活码。不会重置用量或增加项目预算。',
    kinds: { new: '新试用', extend: '延期', replace: '补发' },
    states: { pending: '待处理', approved: '已批准', rejected: '已拒绝', claimed: '已领取' },
    effects: { new: '批准后 7 天内领取，兑换后试用 30 天。', extend: '批准后延期 30 天，不重置次数或费用。', replace: '批准将撤销旧浏览器资格，保留期限与次数。' },
  },
  en: {
    columns: ['Name', 'Type', 'Status', 'Time', 'Notes', 'Actions'],
    table: 'Application review', copy: 'Copy application ID', copied: 'Full ID copied', copyFailed: 'Copy failed. Please retry.',
    note: 'Review note', approve: 'Approve', reject: 'Reject', activate: 'Activate without code',
    activated: 'Activated without code. Ask the applicant to refresh the original browser.',
    confirm: 'Activate 30 days now? The applicant can refresh the original browser without a code. Usage and project budget are unchanged.',
    kinds: { new: 'New trial', extend: 'Extension', replace: 'Replacement' },
    states: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', claimed: 'Claimed' },
    effects: { new: 'Claim within 7 days for a 30-day trial.', extend: 'Approval adds 30 days without resetting usage or costs.', replace: 'Approval revokes old browser sessions and preserves expiry and usage.' },
  },
};
