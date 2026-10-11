import type {AdminTodo} from '../../../backend/admin/core/contracts';
export function dismissibleBudgetMonth(todo:Pick<AdminTodo,'id'|'level'>){return todo.level==='info'?/^finance-budget-(\d{4}-(?:0[1-9]|1[0-2]))-50$/.exec(todo.id)?.[1]:undefined}
export const budgetDismissKey=(month:string)=>`admin-budget-dismiss:${month}`;
export async function dismissBudgetReminder(todo:Pick<AdminTodo,'id'|'level'>,storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,send:(month:string,id:string)=>Promise<unknown>,newId:()=>string=()=>crypto.randomUUID()):Promise<void>{
 const month=dismissibleBudgetMonth(todo);if(!month)throw new Error('BUDGET_REMINDER_NOT_DISMISSIBLE');
 const key=budgetDismissKey(month),id=storage.getItem(key)??newId();storage.setItem(key,id);
 await send(month,id);storage.removeItem(key);
}

