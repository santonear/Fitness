import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Generates additive SQL only. Never uses the production config or replaces the ledger.
const config = JSON.parse(readFileSync('wrangler.admin-preview.jsonc', 'utf8'));
if (config.name !== 'fitness-admin-preview' || config.vars.ADMIN_ENVIRONMENT !== 'preview' || !config.d1_databases.some(db=>db.binding==='CONTROL_DB' && db.database_id==='56ac8260-e90d-488e-882b-0062206e1a5d')) throw new Error('Dedicated preview configuration required');
const now = Date.now();
const period = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit'}).formatToParts(now);
const month = `${period.find(p=>p.type==='year').value}-${period.find(p=>p.type==='month').value}`;
const quote = value => `'${JSON.stringify(value).replaceAll("'", "''")}'`;
const statements = [];
for (const [index, label, days] of [[1,'正常',30],[2,'即将到期',1],[3,'额度恢复结果未知',30]]) {
  const id = `9${index}000000-000${index}-4000-8000-00000000000${index}`;
  const application = `a${index}000000-000${index}-4000-8000-00000000000${index}`;
  const subject = {expiresAt:now + days*86400000, revoked:false};
  const app = {id:application, ownerDigest:String(index).repeat(64), kind:'new', name:`预览合成 · ${label}`, note:'仅用于独立预览验收，不是真实用户。', createdAt:now-86400000, state:'claimed', subjectId:id, directlyActivated:true};
  const event = {at:now, event:index===3?'quota-restore-unknown':'subject-directly-activated', subjectId:id};
  // Existing fixtures and administrator changes are retained on repeat execution.
  statements.push(`UPDATE control_ledger SET state=json_insert(json_insert(state, '$.subjects."${id}"', json(${quote(subject)}), '$.applications."${application}"', json(${quote(app)}), '$.usages."${id}:${month}"', json(${quote({understand:0,generate:index===3?2:1,summary:0})})), '$.audit[#]', json(${quote(event)})), revision=revision+1 WHERE id=1 AND json_type(state, '$.subjects."${id}"') IS NULL;`);
}
// Synthetic lost response: a committed restoration exists before the retry is offered.
const retryId='94000000-0004-4000-8000-000000000004', subjectId='93000000-0003-4000-8000-000000000003';
const receipt={subjectId,period:month,reason:'预览合成：额度恢复响应丢失',at:now,credits:{understand:0,generate:2}};
const unknown={at:now,event:`quota-restore-unknown:${retryId}`,subjectId};
statements.push(`UPDATE control_ledger SET state=json_insert(json_insert(state, '$.quotaRestorations', json('{}')), '$.quotaRestorations."${retryId}"', json(${quote(receipt)}), '$.audit[#]', json(${quote(unknown)})), revision=revision+1 WHERE id=1 AND json_type(state, '$.subjects."${subjectId}"') IS NOT NULL AND json_type(state, '$.quotaRestorations."${retryId}"') IS NULL;`);
mkdirSync('.cache', {recursive:true});
writeFileSync('.cache/admin-preview-users.sql', statements.join('\n')+'\n');
console.log('Prepared three additive synthetic fixtures for the isolated preview database.');
