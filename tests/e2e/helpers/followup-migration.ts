import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
export async function checkV8Upgrade(source: any, fail = false) {
 const name=`followup-${crypto.randomUUID()}`, model=createDatabase(name);
 const stores=Object.fromEntries(model.tables.filter(table=>!['nutritionRecords','activityImportReceipts'].includes(table.name)).map(table=>[table.name,[table.schema.primKey.src,...table.schema.indexes.map(index=>index.src)].join(',')]));
 const old=new Dexie(name);old.version(8).stores(stores);await old.open();
 const rows:Record<string,any[]>={...source.data,metadata:[source.data.metadata],trainingMemo:[source.data.trainingMemo],v8State:[source.data.v8.state],v8Plans:source.data.v8.plans,v8PlanVersions:source.data.v8.planVersions,v8Workouts:source.data.v8.workouts,v8Activities:source.data.v8.activities};
 for(const table of old.tables)if(Array.isArray(rows[table.name])&&rows[table.name].length)await table.bulkAdd(rows[table.name]);
 const before=Object.fromEntries(await Promise.all(old.tables.map(async table=>[table.name,await table.toArray()])));old.close();
 if(fail)model.on('populate',()=>{throw Error('not used');});
 // Hook the metadata update within upgrade transaction: injected failure must roll back new stores too.
 if(fail)model.metadata.hook('updating',()=>{throw Error('injected upgrade failure');});
 let rejected=false;try{await model.open();}catch{rejected=true;}
 if(fail){model.close();await old.open();const after=Object.fromEntries(await Promise.all(old.tables.map(async table=>[table.name,await table.toArray()])));const result={rejected,version:old.verno,unchanged:JSON.stringify(before)===JSON.stringify(after)};old.close();await Dexie.delete(name);return result;}
 const after=Object.fromEntries(await Promise.all(model.tables.filter(table=>table.name!=='metadata'&&!['nutritionRecords','activityImportReceipts'].includes(table.name)).map(async table=>[table.name,await table.toArray()])));
 const unchanged=Object.entries(after).every(([key,value])=>JSON.stringify(value)===JSON.stringify(before[key]));
 model.close();await model.open();const result={unchanged,version:model.verno,metadata:(await model.metadata.toCollection().first())?.schemaVersion,empty:await model.nutritionRecords.count()===0&&await model.activityImportReceipts.count()===0};model.close();await Dexie.delete(name);return result;
}
