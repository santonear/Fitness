import { expect, it, vi } from 'vitest';
import { supplierDiagnostics } from '../../src/backend/supplier-diagnostics';
it('defaults off and only emits bounded stage/status, dropping all content and identifiers', () => {
 const write=vi.fn(); const input={stage:'http',httpStatus:401,message:'private content',apiKey:'secret',requestId:'identity'};
 supplierDiagnostics(false,write)(input); expect(write).not.toHaveBeenCalled();
 const report=supplierDiagnostics(true,write); report(input);
 expect(write).toHaveBeenLastCalledWith({event:'supplier_failure',stage:'http',httpStatus:401});
 report({stage:'private content',httpStatus:200});expect(write).toHaveBeenCalledTimes(1);
 report({stage:'candidate',httpStatus:Infinity});expect(write).toHaveBeenLastCalledWith({event:'supplier_failure',stage:'candidate'});
 expect(()=>supplierDiagnostics(true,()=>{throw Error('log unavailable');})({stage:'decode'})).not.toThrow();
});
