import {expect,it,vi} from 'vitest';
import {claimDirectActivation} from '../../src/ai/trial-recovery';
const receipt='a'.repeat(64),id='0fb6e661-e282-49ef-bcc6-bcb31c3e9836';
const direct={id,kind:'new',state:'approved',createdAt:1,claimUntil:Date.now()+86400000,directlyActivated:true};
it.each([{state:'pending'},{state:'rejected'},{directlyActivated:false},{claimUntil:1}])('does not auto-claim ineligible applications %j',async(change)=>{
 const claim=vi.fn();expect(await claimDirectActivation(receipt,[{...direct,...change}],claim)).toBe(false);expect(claim).not.toHaveBeenCalled();
});
it('allows an unexpired previously claimed direct activation to restore its original browser session',async()=>{
 const claim=vi.fn();expect(await claimDirectActivation(receipt,[{...direct,state:'claimed'}],claim)).toBe(true);expect(claim).toHaveBeenCalledWith({receipt,id});
});
it('coalesces claims from separate mounted views using the same receipt and application',async()=>{
 const first=vi.fn(async()=>{}),second=vi.fn(async()=>{});
 expect(await Promise.all([claimDirectActivation(receipt,[direct],first),claimDirectActivation(receipt,[direct],second)])).toEqual([true,true]);
 expect(first).toHaveBeenCalledTimes(1);expect(second).not.toHaveBeenCalled();
});
