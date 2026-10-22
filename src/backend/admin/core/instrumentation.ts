import type {ControlStore,ControlState} from '../../store';
import type {AdminDatabase} from './contracts';
import {recordFinanceEvent} from '../finance';
import { sha256Hex } from '../../../domain/hex';
type LedgerRequest=ControlState['requests'][string];
const signature=(r:LedgerRequest)=>`${r.status}:${r.actualCost??''}:${r.bound}`;
/** Track committed metadata changes, outside callbacks which CAS may replay. */
export function trackFinanceChanges(store:ControlStore){
 const changed=new Set<string>();
 const tracked:ControlStore={read:()=>store.read(),async transact(change){
  const result=await store.transact(state=>{
   const before=new Map(Object.entries(state.requests).map(([id,r])=>[id,signature(r)]));
   const value=change(state);
   return {value,keys:Object.entries(state.requests).filter(([id,r])=>r.createdAt!==undefined&&before.get(id)!==signature(r)).map(([id])=>id)};
  });
  result.keys.forEach(id=>changed.add(id));return result.value;
 }};
 return {store:tracked,changed};
}
/** Explicit keys avoid hashing or rewriting the complete ledger on every API read. */
export async function syncFinanceMetadata(store:ControlStore,db:AdminDatabase,keys:Iterable<string>){
 const ids=[...keys];if(!ids.length)return;
 const state=await store.read();
 for(const id of ids){const r=state.requests[id];if(!r||r.createdAt===undefined||r.status==='reserved')continue;
  const eventKey=await sha256Hex(`${r.subjectId}:${r.requestId}`);
  const tasks={ONBOARD_PLAN:'generate',ADJUST_TODAY:'adjust',MODIFY_PLAN:'modify',PERIOD_REVIEW:'review'} as const;
  const task=tasks[r.coachContract?.task as keyof typeof tasks]??r.operation;
  const status=r.status==='settled'?'settled':r.status==='released'?'released':'pending';
  await recordFinanceEvent(db,{eventKey,day:new Date(r.createdAt).toISOString().slice(0,10),task,status,costFen:status==='settled'?r.actualCost??0:0,reservedFen:status==='pending'?r.bound:0,at:r.createdAt});
 }
}
