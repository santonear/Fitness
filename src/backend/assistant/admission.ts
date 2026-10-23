import { shortId } from '../admin/core/short-id';
import type { AdminDatabase } from '../admin/core/contracts';
import { todayIn } from '../../domain/local-date';
export class AssistantAccessError extends Error {
  constructor(
    public code: string,
    public status: number,
    public resetAt?: number,
  ) {
    super(code);
  }
}
interface DailyState {
  subject_id: string;
  day: string;
  time_zone: string;
  reset_at: number;
  used: number;
  active_request: string | null;
  lease_until: number;
}
export const localDay = (now: number, timeZone: string) => todayIn(timeZone, now);
/** Find the next local date boundary, including DST and non-whole-hour offsets. */
export function nextMidnight(now: number, timeZone: string) {
  const day = localDay(now, timeZone);
  let lo = now,
    hi = now + 27 * 3600000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDay(mid, timeZone) === day) lo = mid;
    else hi = mid;
  }
  return hi;
}
function admissionWindow(previous: DailyState | null, now: number, timeZone: string) {
  if (previous && previous.lease_until > now && previous.active_request)
    throw new AssistantAccessError('CONCURRENT_REQUEST', 409);
  if (previous && now < previous.reset_at)
    return { day: previous.day, timeZone: previous.time_zone, resetAt: previous.reset_at, used: previous.used };
  // The first admitted zone stays with the subject: switching to a zone whose midnight is near would open extra windows.
  // shortcut: a user who moves zones keeps the old reset time; allow a rate-limited zone change if anyone asks.
  const zone = previous?.time_zone ?? timeZone;
  return { day: localDay(now, zone), timeZone: zone, resetAt: nextMidnight(now, zone), used: 0 };
}
export interface UsageCall {
  inputTokens?: number;
  outputTokens?: number;
  result: string;
  stage: string;
  failureCode?: string;
  failureDetail?: string;
}
interface UsagePrice {
  inputFenPerMillion: number;
  outputFenPerMillion: number;
  version: string;
}
function estimateFen(call: UsageCall, price: UsagePrice): number | null {
  return call.inputTokens === undefined || call.outputTokens === undefined
    ? null
    : (call.inputTokens * price.inputFenPerMillion + call.outputTokens * price.outputFenPerMillion) / 1000000;
}
export class AssistantUsageStore {
  constructor(private db: AdminDatabase) {}
  async read(subjectId: string) {
    return this.db.prepare('SELECT * FROM assistant_daily WHERE subject_id=?').bind(subjectId).first<DailyState>();
  }
  async admit(subjectId: string, requestId: string, timeZone: string, limit: number, now: number) {
    const previous = await this.read(subjectId),
      w = admissionWindow(previous, now, timeZone);
    if (w.used >= limit) throw new AssistantAccessError('DAILY_MESSAGE_LIMIT', 429, w.resetAt);
    if (
      await this.db
        .prepare('SELECT result FROM assistant_requests WHERE subject_id=? AND request_id=?')
        .bind(subjectId, requestId)
        .first()
    )
      throw new AssistantAccessError('REQUEST_ALREADY_HANDLED', 409);
    await this.db
      .prepare('INSERT OR IGNORE INTO assistant_daily(subject_id,day,time_zone,reset_at,used) VALUES(?,?,?,?,0)')
      .bind(subjectId, w.day, w.timeZone, w.resetAt)
      .run();
    // A single conditional write serializes all isolates and reserves the message, so a reply whose stream is
    // dropped before finish() still counts. Leases exceed the hard request timeout.
    const changed = await this.db
      .prepare(
        'UPDATE assistant_daily SET day=?,time_zone=?,reset_at=?,used=CASE WHEN reset_at<=? THEN 1 ELSE used+1 END,active_request=?,lease_until=? WHERE subject_id=? AND lease_until<=? AND (reset_at<=? OR used<?) AND NOT EXISTS(SELECT 1 FROM assistant_requests WHERE subject_id=? AND request_id=?)',
      )
      .bind(
        w.day,
        w.timeZone,
        w.resetAt,
        now,
        requestId,
        now + 180000,
        subjectId,
        now,
        now,
        limit,
        subjectId,
        requestId,
      )
      .run();
    if (changed.meta.changes !== 1) {
      const current = await this.read(subjectId);
      if (current && current.used >= limit && current.reset_at > now)
        throw new AssistantAccessError('DAILY_MESSAGE_LIMIT', 429, current.reset_at);
      throw new AssistantAccessError('CONCURRENT_REQUEST', 409);
    }
    await this.db
      .prepare("INSERT INTO assistant_requests(subject_id,request_id,at,result) VALUES(?,?,?,'running')")
      .bind(subjectId, requestId, now)
      .run();
    return w;
  }
  /** `consumed` keeps the message reserved at admission; false refunds it (server-side failure only). */
  async finish(
    subjectId: string,
    requestId: string,
    task: string,
    consumed: boolean,
    calls: UsageCall[],
    price: UsagePrice,
    now: number,
    result: string,
  ) {
    const statements = [
      this.db
        .prepare("UPDATE assistant_requests SET result=? WHERE subject_id=? AND request_id=? AND result='running'")
        .bind(result, subjectId, requestId),
      this.db
        .prepare(
          'UPDATE assistant_daily SET used=CASE WHEN ? THEN used ELSE MAX(used-1,0) END,active_request=NULL,lease_until=0 WHERE subject_id=? AND active_request=?',
        )
        .bind(consumed ? 1 : 0, subjectId, requestId),
    ];
    for (const [index, call] of calls.entries())
      statements.push(
        this.db
          .prepare(
            'INSERT OR IGNORE INTO assistant_usage(id,at,subject_short_id,task,stage,input_tokens,output_tokens,estimated_fen,result,pricing_version,failure_detail) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            `${subjectId}:${requestId}:${index}`,
            now,
            shortId(subjectId),
            task,
            call.stage,
            call.inputTokens ?? null,
            call.outputTokens ?? null,
            estimateFen(call, price),
            call.failureCode ?? call.result,
            price.version,
            call.failureDetail ?? null,
          ),
      );
    await this.db.batch(statements);
  }
}
