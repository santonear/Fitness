/** Node 24. Default: offline preflight. This file never reads provider credentials. */
import { createServer } from 'vite';
import { open, readFile, writeFile, mkdir, rename, unlink, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { evaluationUsageCalls } from './assistant-v2-metrics.ts';

const endpoint = 'https://fitness-ai-assistant-preview.initdevl.workers.dev/api/v1/assistant/chat';
const version = 'assistant-v3.2.0-engine-v1',
  budgetCny = 5,
  inputPrice = 2,
  outputPrice = 8,
  maxCalls = 4,
  maxTokensPerCall = 3000;
const args = process.argv.slice(2),
  execute = args.includes('--execute');
const allowed = new Set(['--execute', '--version', '--revision', '--cookie-file', '--scenario']);
const options = new Map<string, string>();
for (let index = 0; index < args.length; index++) {
  const key = args[index];
  if (!allowed.has(key) || options.has(key)) throw Error('UNKNOWN_OR_DUPLICATE_ARGUMENT');
  if (key === '--execute') {
    options.set(key, 'true');
    continue;
  }
  const value = args[++index];
  if (!value || value.startsWith('--')) throw Error('ARGUMENT_VALUE_REQUIRED');
  options.set(key, value);
}
const revision = options.get('--revision') ?? 'offline';
if (!/^[a-zA-Z0-9._-]{1,40}$/.test(revision)) throw Error('INVALID_REVISION');
if (options.has('--version') && options.get('--version') !== version) throw Error('ENGINE_PROMPT_VERSION_REQUIRED');
if (
  execute &&
  (!options.has('--version') || !options.has('--revision') || !options.has('--cookie-file') || revision === 'offline')
)
  throw Error('EXECUTE_REQUIRES_EXPLICIT_VERSION_REVISION_COOKIE_FILE');
// A single round's ledger is shared by every worktree; changing revisions never resets its ¥5 ceiling.
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const commonGit = resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim());
const directory = resolve(commonGit, '..', '.cache', 'training-engine-eval-round1');
await mkdir(directory, { recursive: true });
const lockPath = resolve(directory, 'run.lock'),
  lock = await open(lockPath, 'wx').catch(() => {
    throw Error('EVALUATION_LOCKED_OR_STALE_LOCK_REQUIRES_REVIEW');
  });
let vite: Awaited<ReturnType<typeof createServer>> | undefined;
type Entry = {
  scenarioId: string;
  revision: string;
  version: string;
  requestId: string;
  reservedCny: number;
  chargedCny?: number;
  status: 'reserved' | 'measured' | 'failed-upper-bound' | 'bound-violation' | 'version-mismatch';
  report?: string;
};
type Journal = { version: 1; round: 'training-engine-round1'; budgetCny: 5; entries: Entry[] };
try {
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), execute }));
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const scenariosModule = await vite.ssrLoadModule('/tests/eval/training-engine-live-scenarios.ts');
  const { assistantPrompt } = await vite.ssrLoadModule('/src/backend/assistant/prompts.ts');
  const scenarios = scenariosModule.trainingEngineLiveScenarios.filter(
    (row: { id: string }) => !options.has('--scenario') || row.id === options.get('--scenario'),
  );
  if (!scenarios.length) throw Error('UNKNOWN_SCENARIO');
  const journalPath = resolve(directory, 'budget-journal.json');
  let journal: Journal;
  try {
    journal = JSON.parse(await readFile(journalPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    journal = { version: 1, round: 'training-engine-round1', budgetCny: 5, entries: [] };
  }
  const statuses = ['reserved', 'measured', 'failed-upper-bound', 'bound-violation', 'version-mismatch'];
  if (
    journal.version !== 1 ||
    journal.round !== 'training-engine-round1' ||
    journal.budgetCny !== 5 ||
    !Array.isArray(journal.entries) ||
    journal.entries.some(
      row =>
        !statuses.includes(row.status) ||
        row.version !== version ||
        !row.scenarioId ||
        !row.revision ||
        !row.requestId ||
        !Number.isFinite(row.reservedCny) ||
        row.reservedCny <= 0 ||
        (row.status === 'measured' && row.chargedCny === undefined) ||
        (row.chargedCny !== undefined && (!Number.isFinite(row.chargedCny) || row.chargedCny <= 0)),
    )
  )
    throw Error('INVALID_BUDGET_JOURNAL');
  if (execute && journal.entries.some(row => row.status !== 'measured'))
    throw Error('UNRESOLVED_PRIOR_ATTEMPT_REQUIRES_REVIEW');
  const spent = () => journal.entries.reduce((sum, row) => sum + (row.chargedCny ?? row.reservedCny), 0);
  if (spent() > budgetCny) throw Error('ROUND_BUDGET_ALREADY_EXCEEDED');
  const save = async () => {
    const temp = resolve(directory, `journal-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(journal, null, 2), { flag: 'wx', mode: 0o600 });
    await rename(temp, journalPath);
  };
  let cookie: string | undefined;
  if (execute) {
    const cache = await realpath(resolve('.cache')),
      file = await realpath(resolve(options.get('--cookie-file')!)),
      path = relative(cache, file);
    if (!path || path.startsWith('..') || isAbsolute(path))
      throw Error('COOKIE_FILE_MUST_BE_INSIDE_THIS_WORKTREE_CACHE');
    cookie = (await readFile(file, 'utf8')).trim();
    if (!cookie || /[\r\n]/.test(cookie)) throw Error('INVALID_COOKIE_FILE');
  }
  const records: Record<string, unknown>[] = [],
    attempted: string[] = [],
    failures: string[] = [];
  let stopReason = 'completed';
  for (const scenario of scenarios) {
    if (execute && journal.entries.some(row => row.scenarioId === scenario.id && row.revision === revision)) continue;
    const requestId = randomUUID(),
      fixture = scenariosModule.engineLiveFixture(scenario, requestId, randomUUID());
    // UTF-8 bytes bound tokens. Reserve both possible text attempts and both attachment attempts,
    // including maximum JSON escaping of the 16000-character text/prefix and retry feedback.
    const byteCount = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8') + 2048;
    const textPrompt = assistantPrompt(fixture.request, 'text', version);
    const attachmentBound = (retry: boolean) =>
      Math.max(
        ...['exercise', 'plan', 'today', 'change', 'review', 'none'].map(kind =>
          byteCount(
            assistantPrompt(
              fixture.request,
              'attachment',
              version,
              '\0'.repeat(16000),
              retry ? '\0'.repeat(1024) : undefined,
              kind,
            ),
          ),
        ),
      );
    const inputBounds = [
      byteCount(textPrompt),
      byteCount([...textPrompt, { role: 'system', content: '\0'.repeat(16000) + '\0'.repeat(1024) }]),
      attachmentBound(false),
      attachmentBound(true),
    ];
    const reservedCny =
      (inputBounds.reduce((sum, value) => sum + value, 0) * inputPrice + maxCalls * maxTokensPerCall * outputPrice) /
      1e6;
    const preflight = {
      scenarioId: scenario.id,
      revision,
      sourceRevision,
      promptVersion: version,
      reservedCny,
      inputTokenUpperBounds: inputBounds,
      outputTokenUpperBounds: Array(maxCalls).fill(maxTokensPerCall),
      healthSent: false,
      request: fixture.request,
      baselineQuality: fixture.baseline.quality,
    };
    if (!execute) {
      records.push(preflight);
      continue;
    }
    if (scenario.kind !== 'minor' && fixture.baseline.quality?.status !== 'ready')
      throw Error('LOCAL_BASELINE_QUALITY_NOT_READY');
    if (spent() + reservedCny > budgetCny) {
      stopReason = 'budget-reservation-would-exceed-5-cny';
      break;
    }
    const entry: Entry = { scenarioId: scenario.id, revision, version, requestId, reservedCny, status: 'reserved' };
    journal.entries.push(entry);
    await save();
    attempted.push(scenario.id);
    const started = performance.now();
    let events: unknown[] = [],
      httpStatus: number | undefined;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', Origin: new URL(endpoint).origin, Cookie: cookie! },
        body: JSON.stringify(fixture.request),
        signal: AbortSignal.timeout(150000),
      });
      httpStatus = response.status;
      const scored = await scenariosModule.scoreEngineLiveResponse(scenario, fixture, response);
      events = scored.events;
      const done = scored.events.findLast((event: { type: string }) => event.type === 'done');
      if (!response.ok) throw Error('HTTP_REJECTED');
      if (
        done?.usage?.usageEstimated === true ||
        done?.calls?.some((call: { usageEstimated?: boolean }) => call.usageEstimated === true)
      )
        throw Error('ESTIMATED_USAGE_REQUIRES_CONSERVATIVE_HOLD');
      const calls = evaluationUsageCalls(done);
      if (calls.length > maxCalls || !calls.some(call => call.inputTokens > 0 || call.outputTokens > 0))
        throw Error('UNKNOWN_USAGE');
      const measuredCny = calls.reduce(
        (sum, call) => sum + (call.inputTokens * inputPrice + call.outputTokens * outputPrice) / 1e6,
        0,
      );
      const aggregateTokens = calls.reduce((sum, call) => sum + call.outputTokens, 0);
      entry.chargedCny = measuredCny;
      entry.status = 'measured';
      if (
        measuredCny > reservedCny ||
        aggregateTokens > maxCalls * maxTokensPerCall ||
        calls.some(call => call.stage !== 'aggregate' && call.outputTokens > maxTokensPerCall)
      ) {
        entry.status = 'bound-violation';
        stopReason = 'provider-bound-violation-stop-for-review';
      }
      if (done?.promptVersion !== version) {
        entry.status = 'version-mismatch';
        stopReason = 'preview-version-mismatch-stop-for-review';
      }
      const report = {
        ...preflight,
        ...scored,
        httpStatus,
        calls,
        actualCny: measuredCny,
        usageEstimated: done?.usage?.usageEstimated === true,
        costIsUpperBound: false,
        latencyMs: performance.now() - started,
      };
      entry.report = `${scenario.id}-${requestId}.json`;
      await writeFile(resolve(directory, entry.report), JSON.stringify(report, null, 2), { mode: 0o600 });
      records.push(report);
      if (!scored.automatedPass) failures.push(scenario.id);
    } catch (error) {
      // Admission/transport/schema failure does not establish zero provider usage. Retain the full hold.
      entry.status = 'failed-upper-bound';
      entry.chargedCny = Math.max(reservedCny, entry.chargedCny ?? 0);
      stopReason = 'unknown-or-failed-request-stop-for-review';
      failures.push(scenario.id);
      const report = {
        ...preflight,
        events,
        httpStatus,
        actualCny: entry.chargedCny,
        costIsUpperBound: true,
        finalUsable: false,
        safetyRefusal: false,
        automatedPass: false,
        error: error instanceof Error ? error.message : 'UNKNOWN_FAILURE',
        latencyMs: performance.now() - started,
      };
      entry.report = `${scenario.id}-${requestId}.json`;
      await writeFile(resolve(directory, entry.report), JSON.stringify(report, null, 2), { mode: 0o600 });
      records.push(report);
    }
    await save();
    if (stopReason !== 'completed') break;
  }
  const cardAttempts = records.filter(row => execute && !String(row.scenarioId).startsWith('under18-')),
    usable = cardAttempts.filter(row => row.finalUsable === true);
  const summary = {
    mode: execute ? 'execute' : 'offline-preflight',
    endpoint,
    promptVersion: version,
    revision,
    sourceRevision,
    totalBudgetCny: budgetCny,
    pricingCnyPerMillion: { input: inputPrice, output: outputPrice },
    spentOrHeldCny: spent(),
    scenarioCount: scenarios.length,
    attempted,
    stopReason,
    finalUsableRate: {
      numerator: usable.length,
      denominator: cardAttempts.length,
      percent: cardAttempts.length ? (100 * usable.length) / cardAttempts.length : null,
    },
    safeRefusals: records.filter(row => row.safetyRefusal === true).length,
    failedScenarios: failures,
    humanReviewRequired: true,
    records,
  };
  await writeFile(
    resolve(directory, execute ? `report-${revision}-${randomUUID()}.json` : 'offline-preflight.json'),
    JSON.stringify(summary, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ ...summary, records: undefined }));
} finally {
  try {
    await vite?.close();
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
