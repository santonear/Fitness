import type {ControlStore,ControlState} from '../../store';
import {ControlError} from '../../store';
/** Replay the same management transaction inside the ledger CAS; no existing facts are rewritten. */
export function idempotentAdminStore(store:ControlStore,id:string,fingerprint:string,actor:string,now=Date.now):ControlStore{return{read:()=>store.read(),transact:change=>store.transact(state=>{const receipts=state.adminReceipts??={};const old=receipts[id];if(old){if(old.fingerprint!==fingerprint||old.actor!==actor)throw new ControlError('ADMIN_OPERATION_CONFLICT');return old.value as ReturnType<typeof change>}const value=change(state);receipts[id]={fingerprint,actor,at:now(),value:minimalReceipt(value)};return value})}}
export type AdminReceipt={fingerprint:string;actor:string;at:number;value:unknown};

/** Receipts must not retain application notes or any arbitrary transaction return text. */
function minimalReceipt(value:unknown):unknown {if(value===undefined||value===null||typeof value==='boolean'||typeof value==='number')return value;if(typeof value!=='object'||Array.isArray(value))return undefined;const allowed=new Set(['id','subjectId','expiresAt','inviteId','removed','used','limits','credits','understand','generate','summary','period','restored','ok','state']);return Object.fromEntries(Object.entries(value).filter(([key])=>allowed.has(key)).map(([key,v])=>[key,typeof v==='string'?(/^[a-f0-9-]{8,64}$/i.test(v)||/^\d{4}-\d{2}$/.test(v)||['pending','approved','rejected','claimed'].includes(v)?v:undefined):minimalReceipt(v)]));}
