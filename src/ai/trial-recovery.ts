import {z} from 'zod';

export const receiptKey = 'fitness-trial-application-receipt-v1';
export const applicationSchema = z.object({ id: z.uuid(), kind: z.enum(['new','extend','replace']), state: z.enum(['pending','approved','rejected','claimed']), createdAt: z.number().finite(), decidedAt: z.number().optional(), reason: z.string().optional(), claimUntil: z.number().optional(), expiresAt: z.number().optional(), directlyActivated: z.boolean().optional() });
export function readTrialReceipt(): string {
  try { const value=localStorage.getItem(receiptKey); return value && /^[a-f0-9]{64}$/.test(value) ? value : ''; }
  catch { return ''; }
}
const activeClaims=new Map<string,Promise<boolean>>();
/** Only the original receipt owner may claim an administrator's direct activation. */
export async function claimDirectActivation(owner: string, applications: unknown, claim: (body: {receipt:string;id:string}) => Promise<unknown>): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(owner)) return false;
  const parsed=z.array(applicationSchema).safeParse(applications);
  if(!parsed.success)throw new Error('CONTROL_UNAVAILABLE');
  const direct=parsed.data.find(a=>a.directlyActivated && (a.state==='approved'||a.state==='claimed') && (a.claimUntil??0)>Date.now());
  if (!direct) return false;
  const key=owner+':'+direct.id;const current=activeClaims.get(key);if(current)return current;
  const pending=Promise.resolve().then(async()=>{await claim({receipt:owner,id:direct.id});return true;}).finally(()=>activeClaims.delete(key));
  activeClaims.set(key,pending);return pending;
}
