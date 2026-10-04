import { prepareLegacyOperation, type LegacyOperation, type LegacyConfirmation } from '../application/legacy-collisions';
import { DomainError } from '../domain/errors';
export async function withLegacyConfirmation<T>(operation:LegacyOperation,zh:boolean,execute:(confirmation?:LegacyConfirmation)=>Promise<T>):Promise<T>{
  const preview=await prepareLegacyOperation(operation);
  if(!preview.collisions.length)return execute(preview.confirmation);
  const old=preview.legacyTasks.map(task=>`${task.taskId} · ${task.date} · ${task.source} · ${task.originalDate}`).join('\n')||JSON.stringify(operation);
  const current=preview.collisions.map(task=>`${task.name} · ${task.taskId} · ${task.date} · ${task.source} · ${task.originalDate}`).join('\n');
  const message=zh?`旧模型操作将与以下日计划同时存在。不会覆盖、合并或删除；双方任务/训练身份和原统计归属分别保留。\n\n旧安排（任务/日期/来源/原归属）：\n${old}\n\n日计划（名称/任务/日期/来源/原归属）：\n${current}\n\n确认继续？取消不执行。`
    :`This legacy operation will coexist with these day plans. Neither is overwritten, merged or deleted. Each task/session and its original statistical attribution remain separate.\n\nLegacy task/date/source/origin:\n${old}\n\nDay plan name/task/date/source/origin:\n${current}\n\nContinue explicitly? Cancel leaves data unchanged.`;
  if(!window.confirm(message))throw new DomainError('INVALID',zh?'已取消，原数据和输入保留':'Canceled; data and input are preserved');
  return execute(preview.confirmation);
}
