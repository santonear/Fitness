import type { ControlState } from '../../store';
import type { AdminDatabase, AdminTodo } from '../core/contracts';
import { z } from 'zod';

const eventSchema = z.strictObject({eventKey:z.string().regex(/^[a-f0-9]{64}$/), day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), task:z.enum(['generate','adjust','modify','review','understand','summary']), status:z.enum(['settled','pending','fallback']), costFen:z.number().int().nonnegative(), reservedFen:z.number().int().nonnegative(), at:z.number().int().nonnegative()});
/** Caller hashes a stable request identifier; payload and subject identities are rejected. */
export async function recordFinanceEvent(db: AdminDatabase, input: z.infer<typeof eventSchema>) {
  const e = eventSchema.parse(input);
  const result = await db.prepare('INSERT INTO admin_finance_events(event_key,day,task,status,cost_fen,reserved_fen,at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET status=excluded.status,cost_fen=excluded.cost_fen,reserved_fen=excluded.reserved_fen WHERE admin_finance_events.status=\'pending\' AND excluded.status=\'settled\'').bind(e.eventKey,e.day,e.task,e.status,e.costFen,e.reservedFen,e.at).run();
  if (!result.success) throw new Error('FINANCE_EVENT_UNAVAILABLE');
}
export async function dailyCosts(db:AdminDatabase, month:string) {
  return (await db.prepare('SELECT day,task,COUNT(*) AS calls,SUM(CASE WHEN status=\'settled\' THEN cost_fen ELSE 0 END) AS settledFen,SUM(CASE WHEN status=\'pending\' THEN reserved_fen ELSE 0 END) AS pendingFen,SUM(CASE WHEN status=\'fallback\' THEN 1 ELSE 0 END) AS fallbacks,MIN(CASE WHEN status=\'fallback\' THEN at END) AS firstAt,MAX(CASE WHEN status=\'fallback\' THEN at END) AS lastAt FROM admin_finance_events WHERE day LIKE ? GROUP BY day,task ORDER BY day,task').bind(`${month}-%`).all()).results;
}
export async function recentCosts(db:AdminDatabase, now:number) {
  const end=new Date(now).toISOString().slice(0,10),start=new Date(now-6*86400000).toISOString().slice(0,10);
  const rows=(await db.prepare('SELECT day,SUM(CASE WHEN status=\'settled\' THEN cost_fen ELSE 0 END) AS settledFen,SUM(CASE WHEN status=\'pending\' THEN reserved_fen ELSE 0 END) AS pendingFen,SUM(CASE WHEN status=\'fallback\' THEN 1 ELSE 0 END) AS fallbacks,COUNT(*) AS calls FROM admin_finance_events WHERE day>=? AND day<=? GROUP BY day ORDER BY day').bind(start,end).all<{day:string;settledFen:number;pendingFen:number;fallbacks:number;calls:number}>()).results;
  return {start,end,timeZone:'UTC',rows,historicalDailyCoverage:'unavailable' as const};
}
/** No paused claim can be inferred from pending rows: approved planning may continue. */
export function reconciliationTodos(state:ControlState):AdminTodo[] {
  const pending=Object.values(state.requests).filter(r=>r.status==='pending').length;
  return pending||state.recoveryRequired?[{id:'finance-ledger-reconciliation',level:'alert',title:'账本需要核对',text:pending?`有 ${pending} 笔调用等待按供应商账单核算。调用是否可用以当前准入状态为准。`:'账本标记为需要核对。请检查供应商账单和现有费用记录。',actions:[{label:'逐笔核对',href:'/admin/ledger'}]}]:[];
}
export function ledgerProjection(state:ControlState, month:string) {
  const entries=Object.values(state.requests).filter(r=>r.period===month);
  return { month, settledFen:state.budgets[month]?.spent??0, pendingFen:state.budgets[month]?.reserved??0,
    unattributedFen:Math.max(0,(state.budgets[month]?.spent??0)-entries.reduce((s,r)=>s+(r.status==='settled'?r.actualCost??0:0),0)),
    rows:entries.map(r=>({subjectShortId:r.subjectId.slice(0,8),requestShortId:r.requestId.slice(0,8),operation:r.operation,status:r.status,reservedFen:['reserved','submitted','pending'].includes(r.status)?r.bound:0,settledFen:r.status==='settled'?r.actualCost??0:0})), historicalDailyCoverage:'unavailable' };
}
export function financeTodos(spent:number,pending:number,budget:number,month:string):AdminTodo[] {
  const ratio=(spent+pending)/budget, threshold=ratio>=1?100:ratio>=.8?80:ratio>=.5?50:0;
  return threshold?[{id:`finance-budget-${month}-${threshold}`,level:threshold===100?'alert':threshold===80?'warn':'info',title:`本月预算已用到 ${threshold}%`,text:'包含已核算费用与待核算预留；不改变当前调用准入规则。',actions:[{label:'查看费用',href:'/admin/ledger'}]}]:[];
}
export function ledgerCsv(value:ReturnType<typeof ledgerProjection>) {
  const rows=[['month','subject','request','task','status','reserved_fen','settled_fen'],...value.rows.map(r=>[value.month,r.subjectShortId,r.requestShortId,r.operation,r.status,r.reservedFen,r.settledFen]),[value.month,'','','','unattributed',0,value.unattributedFen]];
  return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');
}

