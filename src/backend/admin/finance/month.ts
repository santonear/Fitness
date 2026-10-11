/** Ledger periods follow the same policy timezone as ControlService. */
export function ledgerMonth(now:number, policy?:string):string {
 const timeZone=JSON.parse(policy??'{}').timeZone??'Asia/Shanghai';
 const parts=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit'}).formatToParts(now);
 return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;
}
