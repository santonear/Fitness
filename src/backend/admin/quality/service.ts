import { readFeatureFlags, type FeatureConfigEnv } from '../../feature-config';
import { errorEvent, blockCategory, evaluationReport, isSpike, type QualityEnv, type QualityDatabase } from './contracts';
import { adminJson, type AdminTodo } from '../core/contracts';
import { readJsonBody } from '../../request';

const HOUR = 3600000;
/** Collection needs both the deployment switch and the errorReports flag; the admin page says which. */
export async function errorCollectionEnabled(env: QualityEnv & FeatureConfigEnv): Promise<boolean> { return env.ADMIN_ERROR_COLLECTION_ENABLED === 'true' && !!env.ADMIN_DB && (await readFeatureFlags(env).catch(() => ({ errorReports: false }))).errorReports === true; }
export async function collectError(request: Request, env: QualityEnv, now = Date.now()): Promise<Response> {
  if (env.ADMIN_ERROR_COLLECTION_ENABLED !== 'true' || !env.ADMIN_DB) return adminJson({ error: 'ERROR_COLLECTION_DISABLED' }, 503);
  if (request.method !== 'POST') return adminJson({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return adminJson({ error: 'ORIGIN_REJECTED' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return adminJson({ error: 'INVALID_CONTENT_TYPE' }, 415);
  if (Number(request.headers.get('Content-Length')) > 2048) return adminJson({ error: 'INVALID_EVENT' }, 400);
  let raw: unknown; try { raw = await readJsonBody(request, 2048, problem => problem); } catch { return adminJson({ error: 'INVALID_EVENT' }, 400); }
  const parsed = errorEvent.safeParse(raw);
  if (!parsed.success || Math.abs(parsed.data.time - now) > 300000) return adminJson({ error: 'INVALID_EVENT' }, 400);
  const { type, route, version, browser, os, time } = parsed.data;
  await env.ADMIN_DB.prepare('INSERT INTO admin_quality_errors(type,route,version,browser,os,time) VALUES(?,?,?,?,?,?)').bind(type, route, version, browser, os, time).run();
  return adminJson({ accepted: true }, 202);
}
/** Only the rule category crosses the production instrumentation boundary. */
export async function recordBlockedCategory(db: QualityDatabase, category: unknown, now = Date.now()): Promise<void> {
  const value = blockCategory.parse(category);
  await db.prepare('INSERT INTO admin_quality_blocks(day,category,count) VALUES(?,?,1) ON CONFLICT(day,category) DO UPDATE SET count=count+1').bind(new Date(now).toISOString().slice(0, 10), value).run();
}
export async function saveEvaluation(db: QualityDatabase, input: unknown): Promise<boolean> {
  const value = evaluationReport.parse(input);
  const result = await db.prepare('INSERT OR IGNORE INTO admin_quality_evaluations(id,time,report) VALUES(?,?,?)').bind(value.id, value.time, JSON.stringify(value)).run();
  if (!result.meta.changes) {
    const old = await db.prepare('SELECT report FROM admin_quality_evaluations WHERE id=?').bind(value.id).first<{ report: string }>();
    if (old?.report !== JSON.stringify(value)) throw Error('EVALUATION_ID_CONFLICT');
  }
  return !!result.meta.changes;
}
interface ErrorRow { type: string; route: string; version: string; browser: string; os: string; time: number }
export async function errorSummary(db: QualityDatabase, now: number) {
  const { results } = await db.prepare('SELECT type,route,version,browser,os,time FROM admin_quality_errors WHERE time>? AND time<=? ORDER BY time').bind(now - 8 * 24 * HOUR, now).all<ErrorRow>();
  return [...new Set(results.map(row => row.type))].map(type => {
    const rows = results.filter(row => row.type === type);
    const current = rows.filter(row => row.time > now - HOUR).length;
    const previous = Array.from({ length: 7 }, (_, day) => rows.filter(row => row.time > now - (day + 1) * 24 * HOUR - HOUR && row.time <= now - (day + 1) * 24 * HOUR).length);
    const browserCounts = Object.fromEntries([...new Set(rows.map(row => row.browser))].map(browser => [browser, rows.filter(row => row.browser === browser).length]));
    return { type, count: rows.length, first: rows[0].time, last: rows.at(-1)!.time, versions: [...new Set(rows.map(row => row.version))], browsers: browserCounts, currentHour: current, previousSameHour: previous, spike: isSpike(current, previous), trend: Array.from({ length: 24 }, (_, index) => ({ time: now - (23 - index) * HOUR, count: rows.filter(row => row.time > now - (24 - index) * HOUR && row.time <= now - (23 - index) * HOUR).length })) };
  });
}
export async function qualityTodos(db: QualityDatabase, now: number, pendingOver48h = 0): Promise<AdminTodo[]> {
  const errors = (await errorSummary(db, now)).filter(group => group.spike);
  const todos: AdminTodo[] = errors.map(group => ({ id: `quality:error:${group.type}`, level: 'alert', title: '生产错误增加', text: `最近一小时出现 ${group.currentHour} 次 ${group.type} 错误。`, actions: [{ label: '查看错误', href: '/admin/errors' }] }));
  if (pendingOver48h > 0) todos.push({ id: 'quality:applications48h', level: 'warn', title: '申请等待超过两天', text: `${pendingOver48h} 份申请等待审核。`, actions: [{ label: '逐个审核', href: '/admin/applications' }] });
  return todos;
}
