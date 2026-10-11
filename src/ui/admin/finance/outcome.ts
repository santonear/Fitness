/** Only explicit precondition/validation rejections permit a new edited request. */
export function financeOutcome(error:unknown):'reverify'|'rejected'|'unknown'{
 if(!error||typeof error!=='object')return 'unknown';
 const code='code' in error?error.code:undefined;
 if(code==='FRESH_ACCESS_REQUIRED'||code==='ADMIN_REQUIRED')return 'reverify';
 return ['INVALID_FINANCE_INPUT','INVALID_ANNOUNCEMENT','CONFIG_VERSION_CONFLICT','CONFIG_VERSION_NOT_FOUND','CONFIG_CHOICE_REQUIRED','AMBIGUOUS_LEDGER_ROW','SETTLEMENT_CONFLICT','REQUEST_COST_INVALID'].includes(String(code))?'rejected':'unknown';
}
export const mutationCopy={zh:{success:'操作已完成',reverify:'请重新验证，再确认这次操作',rejected:'请求被拒绝，请检查输入或刷新版本。',unknown:'结果尚未确认，请刷新流水或重试同一次'},en:{success:'Operation completed',reverify:'Verify again, then confirm this request.',rejected:'Request rejected. Check values or refresh the version.',unknown:'The outcome is unknown. Refresh the ledger or retry the same request.'}};
