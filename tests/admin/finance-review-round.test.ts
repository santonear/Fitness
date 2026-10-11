import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {formatAdminTimeZone} from '../../src/ui/admin/time-zone';
import {configReview} from '../../src/ui/admin/finance/config-review';
import {initialState} from '../../src/backend/store';
// @ts-expect-error executable seed tool is deliberately plain ESM
import {buildPreviewFinanceSeed} from '../../tools/admin/prepare-preview-finance.mjs';
it('confirmation lists changed values only while retaining optional key additions/removals',()=>{const a={quotaUnderstand:1,quotaGenerate:1,monthlyBudgetFen:3000,reservationFen:300,maxConcurrent:1,retentionDays:30};expect(configReview(a,a)).toEqual([]);expect(configReview(a,{...a,quotaSummary:2})).toEqual([{field:'quotaSummary',before:undefined,after:2}]);expect(configReview({...a,quotaSummary:2},a)).toEqual([{field:'quotaSummary',before:2,after:undefined}])});
it('formats standard UTC and fractional offsets accurately at the shown instant',()=>{expect(formatAdminTimeZone('Asia/Shanghai','zh')).toBe('东八区（UTC+8）');expect(formatAdminTimeZone('Asia/Shanghai','en')).toBe('UTC+8');expect(formatAdminTimeZone('UTC','zh')).toBe('零时区（UTC+0）');expect(formatAdminTimeZone('America/New_York','en',Date.UTC(2026,6,1))).toBe('UTC-4');expect(formatAdminTimeZone('Asia/Kolkata','en')).toBe('UTC+5:30')});
it('seed is additive, idempotent, revision guarded and refuses production',()=>{
 const config=JSON.parse(readFileSync('wrangler.admin-preview.jsonc','utf8')),now=Date.UTC(2026,9,12,8),state=initialState();state.budgets['2026-10']={spent:100,reserved:20};state.audit.push({at:1,event:'original'});
 const snapshot={control:{revision:4,state},runtimeBudgetFen:3000},seed=buildPreviewFinanceSeed(config,snapshot,now),db=new DatabaseSync(':memory:');
 try{db.exec('CREATE TABLE control_ledger(id INTEGER PRIMARY KEY,revision INTEGER,state TEXT)');db.prepare('INSERT INTO control_ledger VALUES(1,4,?)').run(JSON.stringify(state));db.exec(readFileSync('migrations/admin/3_finance.sql','utf8'));
 db.exec(seed.controlSql);db.exec(seed.adminSql);db.exec(seed.controlSql);db.exec(seed.adminSql);
 const row=db.prepare('SELECT revision,state FROM control_ledger').get() as {revision:number;state:string},actual=JSON.parse(row.state);expect(row.revision).toBe(5);expect(actual.budgets['2026-10']).toEqual({spent:1780,reserved:20});expect(actual.audit[0]).toEqual(state.audit[0]);expect(actual.audit).toHaveLength(2);expect(Object.keys(actual.requests)).toHaveLength(12);expect(db.prepare('SELECT COUNT(*) AS n FROM admin_finance_events').get()).toMatchObject({n:12});expect(db.prepare('SELECT task,COUNT(*) AS n FROM admin_finance_events GROUP BY task').all()).toHaveLength(4);
 expect(buildPreviewFinanceSeed(config,{control:{revision:5,state:actual},runtimeBudgetFen:3000},now).manifest.settledAddedFen).toBe(0);
 expect(()=>buildPreviewFinanceSeed({...config,name:'fitness-production'},snapshot,now)).toThrow('DEDICATED_PREVIEW_REQUIRED');
 const stale=buildPreviewFinanceSeed(config,{control:{revision:3,state},runtimeBudgetFen:3000},now);db.exec(stale.controlSql);expect(db.prepare('SELECT revision FROM control_ledger').get()).toMatchObject({revision:5});
 }finally{db.close()}
});
