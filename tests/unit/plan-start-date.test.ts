import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {DATABASE_VERSION,BACKUP_VERSION} from '../../src/domain/storage-version';
import {createV8Workflow} from '../../src/application/v8-workflow';
import {createRepository} from '../../src/persistence/repository';
import type {FitnessDatabase} from '../../src/persistence/db';
import {v8PlanVersionSchema} from '../../src/domain/schemas';
import {addDays,localDateIn,planStartDate,planWeekDays,startDateLabel,startDateOptions,weekdayOf} from '../../src/application/plan-presentation';

/** In-memory tables over the real v8.0.7 mainline backup sample (same pattern as plan-lifecycle.test.ts). */
function setup(){
 const source=JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v807-mainline.json',import.meta.url),'utf8'));
 source.schemaVersion=BACKUP_VERSION;source.data.metadata.schemaVersion=DATABASE_VERSION;
 let rows:Record<string,any[]>={};for(const [key,value] of Object.entries(source.data))if(Array.isArray(value))rows[key]=structuredClone(value);
 rows.metadata=[source.data.metadata];for(const key of ['plans','planVersions','workouts','activities','planReferences'])rows['v8'+key[0].toUpperCase()+key.slice(1)]=structuredClone(source.data.v8[key]??[]);rows.v8State=[source.data.v8.state];
 let fail='';
 const key=(r:any)=>r.id??r.localProfileId??r.schemaVersion;
 const table=(name:string)=>({name,toArray:async()=>structuredClone(rows[name]),get:async(id:string)=>structuredClone(rows[name].find(r=>key(r)===id)),
  put:async(v:any)=>{if(fail===name)throw Error('injected write failure');rows[name]=rows[name].filter(r=>key(r)!==key(v));rows[name].push(structuredClone(v));},
  add:async(v:any)=>{if(fail===name)throw Error('injected write failure');rows[name].push(structuredClone(v));},
  toCollection:()=>({first:async()=>structuredClone(rows[name][0])}),
  where:(field:string)=>({equals:(value:string)=>({toArray:async()=>structuredClone(rows[name].filter(r=>r[field]===value)),count:async()=>rows[name].filter(r=>r[field]===value).length})})});
 const db:any={tables:[],transaction:async(_m:unknown,_t:unknown,fn:()=>Promise<unknown>)=>{const before=structuredClone(rows);try{return await fn();}catch(e){rows=before;throw e;}}};
 for(const name of Object.keys(rows)){db[name]=table(name);db.tables.push(db[name]);}
 const repo=createRepository(db as FitnessDatabase);
 return {workflow:createV8Workflow(repo),rows:()=>rows,revision:()=>rows.metadata[0].dataRevision as number,fail:(name:string)=>{fail=name;},timeZone:(rows.profiles?.[0]?.timeZone as string|undefined)??'Asia/Shanghai'};
}

describe('plan start date (V9.x)',()=>{
 it('is an optional field: old versions still parse and start on their creation day',()=>{
  const s=setup(),version=s.rows().v8PlanVersions[0];
  expect(version.startDate).toBeUndefined();
  expect(()=>v8PlanVersionSchema.parse(version)).not.toThrow();
  expect(planStartDate(version,'Asia/Shanghai')).toBe(localDateIn('Asia/Shanghai',new Date(version.createdAt)));
  expect(()=>v8PlanVersionSchema.parse({...version,startDate:'2026-13-40'})).toThrow();
 });
 it('changing the start date saves a new version and keeps the old one and every workout unchanged',async()=>{
  const s=setup(),today=localDateIn(s.timeZone),before=structuredClone(s.rows()),target=addDays(today,4);
  const next=await s.workflow.changeStartDate({startDate:target,expectedRevision:s.revision(),summary:'开始日期改为 测试'});
  const old=before.v8PlanVersions[0];
  expect(next).toMatchObject({startDate:target,versionNumber:old.versionNumber+1,basedOnVersionId:old.id,origin:'manual',templates:old.templates,changeSummary:['开始日期改为 测试']});
  expect(s.rows().v8PlanVersions).toHaveLength(before.v8PlanVersions.length+1);
  expect(s.rows().v8PlanVersions.find(v=>v.id===old.id)).toEqual(old);
  expect(s.rows().v8Plans.find(p=>p.id===old.planId).currentVersionId).toBe(next.id);
  expect(s.rows().v8Workouts).toEqual(before.v8Workouts);
  // Same date again is a no-op (no extra version).
  await s.workflow.changeStartDate({startDate:target,expectedRevision:s.revision(),summary:'x'});
  expect(s.rows().v8PlanVersions).toHaveLength(before.v8PlanVersions.length+1);
 });
 it('rejects past dates, dates beyond two weeks and stale revisions without writing',async()=>{
  const s=setup(),today=localDateIn(s.timeZone);
  for(const date of [addDays(today,-1),addDays(today,15),'not-a-date']){
   const before=structuredClone(s.rows());
   await expect(s.workflow.changeStartDate({startDate:date,expectedRevision:s.revision(),summary:'x'})).rejects.toThrow();
   expect(s.rows()).toEqual(before);
  }
  const before=structuredClone(s.rows());
  await expect(s.workflow.changeStartDate({startDate:today,expectedRevision:s.revision()-1,summary:'x'})).rejects.toThrow();
  expect(s.rows()).toEqual(before);
 });
 it('is blocked while a workout is in progress and rolls back on a failed write',async()=>{
  const s=setup(),today=localDateIn(s.timeZone);
  s.rows().v8Workouts[0].status='in_progress';
  await expect(s.workflow.changeStartDate({startDate:addDays(today,1),expectedRevision:s.revision(),summary:'x'})).rejects.toThrow('TRAINING_CHANGED');
  s.rows().v8Workouts[0].status='complete';
  const before=structuredClone(s.rows());s.fail('v8Plans');
  await expect(s.workflow.changeStartDate({startDate:addDays(today,1),expectedRevision:s.revision(),summary:'x'})).rejects.toThrow('injected');
  expect(s.rows()).toEqual(before);
 });
});

describe('start date presentation',()=>{
 it('offers today plus fourteen days and labels them relative to today',()=>{
  const options=startDateOptions('2026-10-19');
  expect(options).toHaveLength(15);expect(options[0]).toBe('2026-10-19');expect(options[14]).toBe('2026-11-02');
  expect(startDateLabel('2026-10-19','2026-10-19','zh')).toBe('今天 · 10月19日 周一');
  expect(startDateLabel('2026-10-20','2026-10-19','zh')).toBe('明天 · 10月20日 周二');
  expect(startDateLabel('2026-10-22','2026-10-19','en')).toBe('Oct 22 Thu');
  expect(startDateLabel('2026-10-19',undefined,'zh',false)).toBe('10月19日');
  expect(weekdayOf('2026-10-25')).toBe('sun');
 });
 it('shows the first plan week from a future start, and the current week with earlier days off after it starts',()=>{
  const future=planWeekDays('2026-10-22','2026-10-19')!;
  expect(future.map(day=>day.date)).toEqual(['2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-10-27','2026-10-28']);
  expect(future[0].day).toBe('thu');expect(future.every(day=>!day.beforeStart)).toBe(true);
  const started=planWeekDays('2026-10-21','2026-10-23')!;
  expect(started[0].date).toBe('2026-10-19');expect(started.filter(day=>day.beforeStart).map(day=>day.date)).toEqual(['2026-10-19','2026-10-20']);
  expect(planWeekDays(undefined,'2026-10-19')).toBeUndefined();
 });
});
