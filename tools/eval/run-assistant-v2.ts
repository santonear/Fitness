/** Node 24: node tools/eval/run-assistant-v2.ts [--execute]. Default is offline preflight. */
import { createServer } from 'vite';
import { mkdir, readFile, writeFile, open } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const endpoint = 'https://fitness-ai-assistant-preview.initdevl.workers.dev/api/v1/assistant/chat';
const requested = new URL(process.env.ASSISTANT_EVAL_URL ?? endpoint);
if (requested.href !== endpoint) throw Error('PREVIEW_ENDPOINT_ONLY');
const execute = process.argv.includes('--execute');
const totalBudgetCny = 5, maxOutputTokens = 1200, maxCalls = 3;
const inputPrice = Number(process.env.ASSISTANT_EVAL_INPUT_CNY_PER_MILLION ?? 2);
const outputPrice = Number(process.env.ASSISTANT_EVAL_OUTPUT_CNY_PER_MILLION ?? 8);
if (![inputPrice, outputPrice].every(value => Number.isFinite(value) && value > 0)) throw Error('INVALID_PRICING');
const directory = resolve('.cache/assistant-v2-eval');
await mkdir(directory, { recursive: true });
const lock = await open(resolve(directory, 'run.lock'), 'wx').catch(() => { throw Error('EVAL_ALREADY_RUNNING_OR_STALE_LOCK_REQUIRES_REVIEW'); });
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
type Entry = { scenarioId: string; requestId: string; reservedCny: number; chargedCny?: number; status: string; report?: string };
type Journal = { version: 1; entries: Entry[] };
try {
 const { assistantV2Scenarios, scoreAssistantV2 } = await vite.ssrLoadModule('/tools/eval/assistant-v2-scenarios.ts');
 const { assistantRequestSchema, sanitizeAssistantRequest } = await vite.ssrLoadModule('/src/assistant/contracts.ts');
 const { assistantPrompt, ASSISTANT_PROMPT_VERSION } = await vite.ssrLoadModule('/src/backend/assistant/prompts.ts');
 const { basicProposal } = await vite.ssrLoadModule('/src/application/v8-workflow.ts');
 const { localProfile } = await vite.ssrLoadModule('/src/application/rules/local-profile.ts');
 const journalPath = resolve(directory, 'budget-journal.json');
 let journal: Journal;
 try { journal = JSON.parse(await readFile(journalPath, 'utf8')); } catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; journal = { version: 1, entries: [] }; }
 if (journal.version !== 1 || !Array.isArray(journal.entries) || journal.entries.some(entry => !Number.isFinite(entry.reservedCny) || entry.reservedCny < 0 || entry.chargedCny !== undefined && (!Number.isFinite(entry.chargedCny) || entry.chargedCny < 0))) throw Error('INVALID_BUDGET_JOURNAL');
 if (execute && journal.entries.some(entry => ['reserved','unknown-or-transport-failure','bound-violation'].includes(entry.status))) throw Error('UNRESOLVED_COST_HOLD_REQUIRES_REVIEW');
 const spent = () => journal.entries.reduce((sum, entry) => sum + (entry.chargedCny ?? entry.reservedCny), 0);
 const save = () => writeFile(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
 let cookie = process.env.ASSISTANT_EVAL_COOKIE;
 if (execute && !cookie && process.env.ASSISTANT_EVAL_COOKIE_FILE) {
  const file = resolve(process.env.ASSISTANT_EVAL_COOKIE_FILE), rel = relative(resolve('.cache'), file);
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error('COOKIE_FILE_MUST_BE_IN_LOCAL_CACHE');
  cookie = (await readFile(file, 'utf8')).trim();
 }
 if (execute && (!cookie || /[\r\n]/.test(cookie))) throw Error('VALID_EVAL_COOKIE_REQUIRED');
 const zeroBand = () => ({ morning: { partial: 0, notStarted: 0 }, daytime: { partial: 0, notStarted: 0 }, evening: { partial: 0, notStarted: 0 } });
 const records: unknown[] = [];
 let stopReason = 'completed', executed = 0;
 for (const scenario of assistantV2Scenarios) {
  if (journal.entries.some(entry => entry.scenarioId === scenario.scenarioId)) continue; // No automatic reruns, even failed calls.
  const requestId = randomUUID(), conversationId = randomUUID(), locale = scenario.locale;
  const common = { version: 'fitness-coach-v8', requestId, conversationId, restoreGeneration: 0, inputSnapshot: 'synthetic-eval', sendConfirmation: 'synthetic-fixtures-only', locale, timeZone: 'Asia/Shanghai', adultConfirmed: true, messages: [] };
  const profile = localProfile({ goalText: locale === 'zh' ? '减脂并保持力量' : 'Fat loss and strength', scheduleOriginalText: locale === 'zh' ? '工作日两次、周末一次，每次40分钟左右' : 'weekdays twice, weekends once, 40 minutes', placeEquipmentText: locale === 'zh' ? '在家，没有器械' : 'At home without equipment', adultConfirmed: true, cautions: [] });
  const { confirmedAt: _confirmedAt, ...wireProfile } = profile;
  const plan = basicProposal(profile, locale), target = { planId: randomUUID(), versionId: randomUUID(), revision: 1 };
  let context: unknown;
  const task = scenario.contextTask ?? ({ 'home-no-equipment': 'ONBOARD_PLAN', 'gym-plan': 'ONBOARD_PLAN', 'clarification-limit': 'ONBOARD_PLAN', 'explicit-duration': 'MODIFY_PLAN', 'explicit-frequency': 'MODIFY_PLAN', 'plan-modification': 'MODIFY_PLAN', 'today-adjustment': 'ADJUST_TODAY', 'short-time': 'ADJUST_TODAY', 'review-facts': 'PERIOD_REVIEW' } as Record<string, string>)[scenario.id];
  if (task === 'ONBOARD_PLAN') context = { ...common, task, profile: wireProfile };
  if (task === 'MODIFY_PLAN') context = { ...common, task, target, plan, instruction: scenario.message };
  if (task === 'ADJUST_TODAY') context = { ...common, task, target, template: plan.templates[0], instruction: scenario.message };
  if (task === 'PERIOD_REVIEW') context = { ...common, task, target, kind: 'week', facts: { from: '2026-10-05', to: '2026-10-11', complete: 0, partial: 0, notStarted: 0, movementCount: 0, missingCount: 0, activityMinutes: 0, trainingSeconds: 0, activityCounts: { walk:0,run:0,cycle:0,swim:0,yoga:0,stairs:0,other:0 }, reasonCounts: { time:0,fatigue:0,discomfort:0,equipment_busy:0,not_today:0,other:0 }, hasBodyWeight: false, incompleteTiming: { weekday: zeroBand(), weekend: zeroBand() }, improvements: [] } };
  const request = assistantRequestSchema.parse({ version: 'fitness-assistant-v2', requestId, conversationId, locale, timeZone: 'Asia/Shanghai', adultConfirmed: !scenario.id.startsWith('minor'), messages: [{ role: 'user', content: scenario.message }], ...(context ? { context } : {}), consent: { body: false, history: false } });
  // Byte fallback tokenization cannot exceed UTF-8 bytes. NUL maximizes JSON escaping of the server's 16000-character text cap.
  const effectiveRequest = sanitizeAssistantRequest(request);
  const promptBytes = ['text', 'attachment', 'attachment'].map((stage, i) => Buffer.byteLength(JSON.stringify(assistantPrompt(effectiveRequest, stage, ASSISTANT_PROMPT_VERSION, i ? '\0'.repeat(16000) : '', i === 2 ? 'ATTACHMENT_VALIDATION_FAILED: use exact schema, catalog, context identity and task' : undefined)), 'utf8') + 1024);
  const reservedCny = (promptBytes.reduce((sum, bytes) => sum + bytes, 0) * inputPrice + maxCalls * maxOutputTokens * outputPrice) / 1e6;
  const preflight = { scenarioId: scenario.scenarioId, task: task ?? 'chat', promptInputTokenUpperBounds: promptBytes, outputTokensPerCall: maxOutputTokens, reservedCny, request };
  if (!execute) { records.push(preflight); continue; }
  if (spent() + reservedCny > totalBudgetCny) { stopReason = 'budget-reservation-would-exceed-5-cny'; break; }
  const entry: Entry = { scenarioId: scenario.scenarioId, requestId, reservedCny, status: 'reserved' };
  journal.entries.push(entry); await save(); // Crash or unknown usage retains the complete hold.
  const started = performance.now(); let events: any[] = [], httpStatus: number | undefined;
  try {
   const response = await fetch(endpoint, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Origin: new URL(endpoint).origin, Cookie: cookie! }, body: JSON.stringify(request), signal: AbortSignal.timeout(150000) });
   httpStatus = response.status;
   if (!response.ok) throw Error('HTTP_REJECTED');
   const stream = await response.text();
   events = stream.split(/\r?\n\r?\n/).flatMap(frame => { const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); return data && data !== '[DONE]' ? [JSON.parse(data)] : []; });
   const done = events.findLast(event => event.type === 'done');
   if (!done || !Array.isArray(done.calls) || !done.calls.length || done.calls.length > maxCalls || done.calls.some((call: any) => !Number.isInteger(call.inputTokens) || call.inputTokens < 0 || !Number.isInteger(call.outputTokens) || call.outputTokens < 0)) throw Error('UNKNOWN_USAGE');
   const actualCny = done.calls.reduce((sum: number, call: any) => sum + (call.inputTokens * inputPrice + call.outputTokens * outputPrice) / 1e6, 0);
   entry.chargedCny = actualCny; entry.status = done.success ? 'completed' : 'generation-failed';
   if (actualCny > reservedCny || done.calls.some((call: any) => call.outputTokens > maxOutputTokens)) { entry.status = 'bound-violation'; stopReason = 'server-bound-violation'; }
   const score = scoreAssistantV2(scenario, events);
   const report = { ...preflight, events, outputText: events.filter(event => event.type === 'text_delta').map(event => event.delta).join(''), latencyMs: performance.now() - started, httpStatus, calls: done.calls, actualCny, price: { inputCnyPerMillion: inputPrice, outputCnyPerMillion: outputPrice }, score };
   entry.report = `${scenario.scenarioId}-${createHash('sha256').update(requestId).digest('hex').slice(0,8)}.json`;
   await writeFile(resolve(directory, entry.report), JSON.stringify(report, null, 2), { mode: 0o600 }); records.push(report); executed++;
  } catch { entry.status = 'unknown-or-transport-failure'; stopReason = 'unknown-cost-held-no-retry'; records.push({ scenarioId: scenario.scenarioId, events, httpStatus, latencyMs: performance.now() - started, reservedCny, status: entry.status }); }
  await save();
  if (stopReason !== 'completed') break;
 }
 const summary = { mode: execute ? 'execute' : 'dry-run', endpoint, scenarios: assistantV2Scenarios.length, executed, alreadyAttempted: journal.entries.length, totalBudgetCny, cumulativeSpentOrHeldCny: spent(), stopReason, automatedPassedThisRun: records.filter((record: any) => record.score?.automatedPass).length, humanReviewStillRequired: true, records };
 await writeFile(resolve(directory, execute ? 'latest-report.json' : 'preflight.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
 console.log(JSON.stringify({ ...summary, records: undefined }));
} finally { await vite.close(); await lock.close(); await (await import('node:fs/promises')).unlink(resolve(directory, 'run.lock')); }
