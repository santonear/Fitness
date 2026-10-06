/** Public control errors only; never display arbitrary server response text. */
export function statusFeedback(code: string, locale: 'en' | 'zh'): string {
 const messages: Record<string, [string, string]> = {
  QUALIFICATION_REQUIRED: ['Redeem an invitation to check your trial.', '请兑换邀请码后查询试用资格。'],
  INVITE_INVALID: ['This invitation is invalid or already used.', '邀请码无效或已经使用。'],
  INVITE_NOT_FOUND: ['This invitation was not found.', '未找到该邀请码。'],
  SUBJECT_EXPIRED: ['Your trial has expired. Local plans and candidates remain available.', '试用已到期，本地计划和候选仍可使用。'],
  SUBJECT_NOT_FOUND: ['Qualification is unavailable or revoked. Local data is unchanged.', '资格不可用或已撤销，本地数据不受影响。'],
  AI_DISABLED: ['Model requests are disabled. Local training remains available.', '模型请求尚未启用，本地训练仍可使用。'],
  INDIVIDUAL_QUOTA_EXHAUSTED: ['Your trial request allowance is exhausted.', '个人试用请求次数已用完。'],
  GLOBAL_BUDGET_EXHAUSTED: ['AI allowance for this period is insufficient. Please wait for accounting or allowance recovery. Local training remains available. This is not a personal payment request.', '本期 AI 可用额度不足，请等待费用核算或额度恢复。本地训练仍可继续。这不是个人欠费或付款要求。'],
  COST_BOUND_UNVERIFIED: ['The request cost bound cannot be verified. New AI calls are paused; local training remains available.', '暂时无法确认单次费用上界，已暂停新增 AI 调用；本地训练仍可继续。'],
  RECONCILIATION_REQUIRED: ['Requests are paused while project usage is reconciled.', '项目用量正在对账，请求已暂停。'],
  RESULT_UNAVAILABLE: ['The server does not retain this candidate. A new confirmed request may use another allowance and incur additional cost.', '服务端不保留该候选。重新确认的新请求可能再次占用次数并产生费用。'],
  ACCOUNTING_PENDING: ['The submitted request is awaiting accounting. Its reserved budget has not been released.', '已提交请求待核算，预留预算尚未释放。'],
  CANDIDATE_ACCOUNTING_PENDING: ['Candidate received; its fee is awaiting accounting and the full reservation remains occupied. You may review and explicitly save it locally. Further calls depend on verified cost bounds, available allowance and service status.', '候选已收到，费用待核算，完整预留仍被占用。可查看并明确保存到本地；能否继续调用取决于已验证的费用上界、剩余额度与服务状态。'],
  REQUEST_IN_PROGRESS: ['This request is already processing. Do not submit another request to replace it.', '本请求正在处理，请勿以新请求重复提交。'],
  REQUEST_CONFLICT: ['This request ID already refers to different input.', '该请求标识已对应另一份输入。'],
  CONCURRENCY_LIMIT: ['The service is busy. No automatic retry is performed.', '服务正忙，不会自动重试。'],
  REQUEST_COST_BOUND: ['This request exceeds the allowed cost bound.', '本次请求超出允许的费用边界。'],
  DATE_BOUND_EXCEEDED: ['Too many dates for one request.', '本次请求的日期数量超限。'],
  CONTROL_UNAVAILABLE: ['Backend status is unknown. The service may be unavailable or not configured.', '后端状态未知，服务可能不可用或尚未配置。'],
 };
 return (messages[code] ?? ['Operation failed or status is unknown. Keep your candidate and local data.', '操作失败或状态未知。请保留候选和本地数据。'])[locale === 'zh' ? 1 : 0];
}
