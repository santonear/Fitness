import type {RuntimeConfig} from '../../../backend/admin/finance/runtime';
export function configReview(before:RuntimeConfig,after:RuntimeConfig){
 return [...new Set([...Object.keys(before),...Object.keys(after)])].map(key=>{const field=key as keyof RuntimeConfig;return{field,before:before[field],after:after[field]}}).filter(row=>row.before!==row.after);
}
export function canDismissBudget(spent:number,pending:number,budget:number,dismissed:boolean){return !dismissed&&budget>0&&(spent+pending)/budget>=.5&&(spent+pending)/budget<.8}
