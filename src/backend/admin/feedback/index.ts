import { z } from 'zod';
import { adminJson, AdminError, requireAdminDb, type AdminContext } from '../core/contracts';

/**
 * 留言 page. Only messages users explicitly sent from 我的 → 给我们留言 are
 * listed here; no training, health or chat content is ever joined in.
 */
export interface FeedbackRow {
  id: string;
  createdAt: number;
  subjectShortId: string | null;
  message: string;
  contact: string | null;
  locale: string;
  status: 'new' | 'handled';
  handledAt: number | null;
}
type Raw = {
  id: string;
  created_at: number;
  subject_short_id: string | null;
  message: string;
  contact: string | null;
  locale: string;
  status: 'new' | 'handled';
  handled_at: number | null;
};
const row = (r: Raw): FeedbackRow => ({
  id: r.id,
  createdAt: r.created_at,
  subjectShortId: r.subject_short_id,
  message: r.message,
  contact: r.contact,
  locale: r.locale,
  status: r.status,
  handledAt: r.handled_at,
});
const feedbackStatusSchema = z.strictObject({ id: z.uuid(), status: z.enum(['new', 'handled']) });
export async function handleFeedbackAdmin(request: Request, c: AdminContext): Promise<Response | undefined> {
  const url = new URL(request.url),
    part = url.pathname.split('/console/')[1];
  if (part !== 'feedback' && part !== 'feedback/status') return;
  const db = requireAdminDb(c);
  if (request.method === 'GET' && part === 'feedback') {
    const filter = url.searchParams.get('filter') === 'all' ? 'all' : 'open';
    const items = (
      await db
        .prepare(
          `SELECT id,created_at,subject_short_id,message,contact,locale,status,handled_at FROM user_feedback${filter === 'open' ? " WHERE status='new'" : ''} ORDER BY created_at DESC,id DESC LIMIT 500`,
        )
        .all<Raw>()
    ).results.map(row);
    const counts = await db
      .prepare("SELECT SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS open,COUNT(*) AS total FROM user_feedback")
      .first<{ open: number | null; total: number | null }>();
    return adminJson({ filter, items, open: counts?.open ?? 0, total: counts?.total ?? 0 });
  }
  if (request.method === 'POST' && part === 'feedback/status') {
    const v = feedbackStatusSchema.parse(await request.json());
    const result = await db
      .prepare('UPDATE user_feedback SET status=?,handled_at=?,handled_by=? WHERE id=?')
      .bind(v.status, v.status === 'handled' ? c.now : null, v.status === 'handled' ? c.actor : null, v.id)
      .run();
    if (!result.meta.changes) throw new AdminError('OBJECT_NOT_FOUND', 404);
    await c.audit(v.status === 'handled' ? 'feedback-handled' : 'feedback-reopened', v.id, 'success');
    return adminJson({ ok: true });
  }
  return undefined;
}
