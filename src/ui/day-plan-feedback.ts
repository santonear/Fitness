export function dayPlanFeedback(reason: unknown, zh: boolean): string {
  const error = reason as {code?: string; message?: string};
  if (!zh) return `${error.code ?? 'INVALID'}: Operation did not finish; input and saved facts are preserved. ${error.message ?? String(reason)}`;
  const messages: Record<string,string> = {
    CONFLICT:'日期已被占用，或计划、本地资料已变化。请保管未提交输入，重新打开并核对后再保存。',
    CALENDAR_PROVENANCE_MISSING:'旧日程的日期或时区无法唯一解释，需要核对。原任务和统计保留，相关日期暂不安排新计划。',
    WORKOUT_IN_PROGRESS:'此日训练正在进行，或已完成。请先处理进行中的训练；完成课表保持只读。',
    SESSION_READ_ONLY:'此日已有完成训练，保持只读；隐藏后仍占日期槽。',
    STORAGE_FULL:'本地存储空间不足。未提交输入和原数据保留，请先保管备份再处理空间。',
    INVALID:'请核对名称、日期、动作及逐组目标；已释放的旧安排需作为独立新日计划保存。',
  };
  return `${error.code ?? 'INVALID'}：操作未完成，输入和已保存事实保留。${messages[error.code ?? 'INVALID'] ?? '暂时无法完成，请保管输入并重试。'}`;
}
