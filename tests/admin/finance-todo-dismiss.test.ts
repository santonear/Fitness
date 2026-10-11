import {expect,it} from 'vitest';
import {budgetDismissKey,dismissBudgetReminder,dismissibleBudgetMonth} from '../../src/ui/admin/todos/budget-dismiss';
it('only exact monthly 50 percent info cards expose dismissal',()=>{
 expect(dismissibleBudgetMonth({id:'finance-budget-2026-10-50',level:'info'})).toBe('2026-10');
 for(const [id,level] of [['finance-budget-2026-10-80','info'],['finance-budget-2026-10-100','alert'],['finance-budget-2026-10-50','warn'],['finance-budget-2026-13-50','info'],['other-2026-10-50','info']] as const)expect(dismissibleBudgetMonth({id,level})).toBeUndefined();
});
it('uncertain response and remount retain exactly one request ID until a confirmed dismissal',async()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}};
 const todo={id:'finance-budget-2026-10-50',level:'info' as const},seen:string[]=[];
 await expect(dismissBudgetReminder(todo,storage,async(month,id)=>{expect(month).toBe('2026-10');seen.push(id);throw new Error('lost response')},()=> 'one-request')).rejects.toThrow('lost response');
 expect(storage.getItem(budgetDismissKey('2026-10'))).toBe('one-request');
 await dismissBudgetReminder({...todo},storage,async(_month,id)=>{seen.push(id)},()=> 'must-not-be-used');
 expect(seen).toEqual(['one-request','one-request']);expect(values.size).toBe(0);
 await expect(dismissBudgetReminder({id:'finance-budget-2026-10-100',level:'alert'},storage,async()=>{throw new Error('network must not run')})).rejects.toThrow('BUDGET_REMINDER_NOT_DISMISSIBLE');
});
