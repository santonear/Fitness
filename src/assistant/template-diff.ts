import type {PlannedItem,SessionTemplate} from '../domain/v8/contracts';

export interface TemplateChange {key:string;templateIndex:number;kind:'added'|'removed'|'replaced'|'updated';item:PlannedItem;previous?:PlannedItem}
/** Match occurrences by identity before pairing genuinely replaced movements. */
export function diffTemplates(before:SessionTemplate[],after:SessionTemplate[]){
 const changes:TemplateChange[]=[];let unchanged=0;
 for(let ti=0;ti<Math.max(before.length,after.length);ti++){
  const old=before[ti]?.items??[],next=after[ti]?.items??[],used=new Set<number>(),added:number[]=[];
  next.forEach((item,index)=>{
   const oi=old.findIndex((previous,j)=>!used.has(j)&&previous.exerciseId===item.exerciseId);
   if(oi<0){added.push(index);return;}used.add(oi);
   if(JSON.stringify(old[oi])===JSON.stringify(item))unchanged++;
   else changes.push({key:`${ti}:updated:${index}`,templateIndex:ti,kind:'updated',item,previous:old[oi]});
  });
  const removed=old.map((_,index)=>index).filter(index=>!used.has(index));
  while(removed.length&&added.length){const oi=removed.shift()!,ni=added.shift()!;changes.push({key:`${ti}:replaced:${ni}`,templateIndex:ti,kind:'replaced',item:next[ni],previous:old[oi]});}
  for(const index of removed)changes.push({key:`${ti}:removed:${index}`,templateIndex:ti,kind:'removed',item:old[index]});
  for(const index of added)changes.push({key:`${ti}:added:${index}`,templateIndex:ti,kind:'added',item:next[index]});
 }
 return {changes,unchanged};
}
