import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HELP = `Fitness control admin (Node 24+)
Usage: node scripts/control-admin.mjs <command> --origin https://your-approved-origin [options]
Secret: CONTROL_ADMIN_SECRET environment variable only. No automatic retries.
Commands:
  report
  issue --show-code                         Interactive terminal only
  revoke-invite --invite-id <64 hex>
  revoke --subject-id <uuid>
  reissue --subject-id <uuid> --show-code    Interactive terminal only
  settle --subject-id <uuid> --request-id <uuid> --actual-cost-fen <integer>
         --evidence-ref <provider-bill-reference> --confirm-provider-bill
  recovery --confirm-recovery
  reconciled --evidence-file <local-json> --evidence-ref <provider-bill-reference>
             --confirm-provider-bill
The operator must independently verify bill evidence. Token estimates are not bills.
Evidence references and files are not printed or sent. Issued codes are never saved.
`;
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const fail = code => { throw new Error(code); };
const integer = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const check = (condition, code = 'INVALID_RESPONSE') => { if (!condition) fail(code); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && UUID.test(value);
const period = value => typeof value === 'string' && PERIOD.test(value);
const bool = value => typeof value === 'boolean';
const rows = (value, project) => { check(Array.isArray(value)); return value.map(project); };

/** Whitelist even a misconfigured admin response; never print arbitrary JSON/error bodies. */
export function safeAdminReport(value) {
  check(record(value) && value.format === 'fitness-control-admin-report' && value.version === 1 &&
    typeof value.capturedAt === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value.capturedAt) && Number.isFinite(Date.parse(value.capturedAt)) && bool(value.aiEnabled) && bool(value.recoveryRequired));
  return { format: value.format, version: 1, capturedAt: value.capturedAt, aiEnabled: value.aiEnabled, recoveryRequired: value.recoveryRequired,
    budgets: rows(value.budgets, row => { check(record(row) && period(row.period) && integer(row.spentFen) && integer(row.reservedFen)); return { period: row.period, spentFen: row.spentFen, reservedFen: row.reservedFen }; }),
    subjects: rows(value.subjects, row => { check(record(row) && id(row.subjectId) && integer(row.expiresAt) && bool(row.revoked) && bool(row.expired)); return { subjectId: row.subjectId, expiresAt: row.expiresAt, revoked: row.revoked, expired: row.expired }; }),
    usages: rows(value.usages, row => { check(record(row) && id(row.subjectId) && period(row.period) && integer(row.understand) && integer(row.generate) && (row.summary === undefined || integer(row.summary))); return { subjectId: row.subjectId, period: row.period, understand: row.understand, generate: row.generate, ...(row.summary === undefined ? {} : {summary: row.summary}) }; }),
    requests: rows(value.requests, row => {
      check(record(row) && id(row.subjectId) && id(row.requestId) && ['understand', 'generate', 'summary'].includes(row.operation) && period(row.period) && integer(row.boundFen) &&
        ['reserved', 'submitted', 'pending', 'settled', 'released'].includes(row.status) && bool(row.cancelled) && (row.actualCostFen === undefined || integer(row.actualCostFen)));
      return { subjectId: row.subjectId, requestId: row.requestId, operation: row.operation, period: row.period, boundFen: row.boundFen, status: row.status, cancelled: row.cancelled,
        ...(row.actualCostFen === undefined ? {} : { actualCostFen: row.actualCostFen }) };
    }),
  };
}

function flags(argv) {
  const [command, ...args] = argv;
  const options = {};
  const switches = new Set(['show-code', 'confirm-provider-bill', 'confirm-recovery']);
  for (let i = 0; i < args.length; i++) {
    const key = args[i].match(/^--([a-z-]+)$/)?.[1];
    check(key && !Object.hasOwn(options, key), 'INVALID_ARGUMENTS');
    if (switches.has(key)) options[key] = true;
    else { check(typeof args[i + 1] === 'string' && !args[i + 1].startsWith('--'), 'INVALID_ARGUMENTS'); options[key] = args[++i]; }
  }
  return { command, options };
}

async function commandRequest(command, options, interactive, readEvidenceFile) {
  const permitted = {
    report: [], issue: ['show-code'], reissue: ['subject-id', 'show-code'], revoke: ['subject-id'], 'revoke-invite': ['invite-id'],
    settle: ['subject-id', 'request-id', 'actual-cost-fen', 'evidence-ref', 'confirm-provider-bill'], recovery: ['confirm-recovery'],
    reconciled: ['evidence-ref', 'evidence-file', 'confirm-provider-bill'],
  };
  check(Object.hasOwn(permitted, command), 'UNKNOWN_COMMAND');
  check(Object.keys(options).every(key => key === 'origin' || permitted[command].includes(key)), 'UNKNOWN_ARGUMENT');
  let path; let body; let allowed = [];
  const subject = () => { check(id(options['subject-id']), 'INVALID_SUBJECT_ID'); return options['subject-id']; };
  const evidence = () => {
    check(options['confirm-provider-bill'] === true && typeof options['evidence-ref'] === 'string' && options['evidence-ref'].trim().length > 0 && options['evidence-ref'].length <= 512, 'PROVIDER_BILL_CONFIRMATION_REQUIRED');
  };
  if (command === 'report') { path = 'report'; body = {}; }
  else if (command === 'issue' || command === 'reissue') {
    check(options['show-code'] === true && interactive, 'INTERACTIVE_CODE_DISPLAY_REQUIRED');
    path = command === 'issue' ? 'invites' : 'reissue'; body = command === 'issue' ? {} : { subjectId: subject() }; allowed = ['show-code', ...(command === 'reissue' ? ['subject-id'] : [])];
  } else if (command === 'revoke') { path = 'revoke'; body = { subjectId: subject() }; allowed = ['subject-id']; }
  else if (command === 'revoke-invite') {
    check(typeof options['invite-id'] === 'string' && /^[a-f\d]{64}$/i.test(options['invite-id']), 'INVALID_INVITE_ID');
    path = 'invites/revoke'; body = { inviteId: options['invite-id'] }; allowed = ['invite-id'];
  } else if (command === 'settle') {
    evidence(); check(typeof options['actual-cost-fen'] === 'string' && /^(0|[1-9]\d*)$/.test(options['actual-cost-fen']) && integer(Number(options['actual-cost-fen'])), 'INVALID_ACTUAL_COST');
    check(id(options['request-id']), 'INVALID_REQUEST_ID');
    path = 'settle'; body = { subjectId: subject(), requestId: options['request-id'], actualCost: Number(options['actual-cost-fen']) };
    allowed = ['subject-id', 'request-id', 'actual-cost-fen', 'evidence-ref', 'confirm-provider-bill'];
  } else if (command === 'recovery') {
    check(options['confirm-recovery'] === true, 'RECOVERY_CONFIRMATION_REQUIRED'); path = 'recovery'; body = {}; allowed = ['confirm-recovery'];
  } else if (command === 'reconciled') {
    evidence(); check(typeof options['evidence-file'] === 'string' && options['evidence-file'].length > 0, 'EVIDENCE_FILE_REQUIRED');
    let content;
    try { content = await readEvidenceFile(options['evidence-file']); check(typeof content === 'string' && Buffer.byteLength(content) <= 1_048_576, 'INVALID_EVIDENCE_FILE'); body = JSON.parse(content); }
    catch { fail('INVALID_EVIDENCE_FILE'); }
    check(record(body) && Object.keys(body).length === 2 && record(body.budgets) && record(body.usages), 'INVALID_RECONCILIATION_EVIDENCE');
    for (const [key, value] of Object.entries(body.budgets)) check(period(key) && integer(value), 'INVALID_RECONCILIATION_EVIDENCE');
    for (const [key, value] of Object.entries(body.usages)) {
      const separator = key.lastIndexOf(':');
      check(id(key.slice(0, separator)) && period(key.slice(separator + 1)) && record(value) && [2,3].includes(Object.keys(value).length) && Object.keys(value).every(key => ['understand','generate','summary'].includes(key)) && integer(value.understand) && integer(value.generate) && (value.summary === undefined || integer(value.summary)), 'INVALID_RECONCILIATION_EVIDENCE');
    }
    path = 'reconciled'; allowed = ['evidence-ref', 'evidence-file', 'confirm-provider-bill'];
  } else fail('UNKNOWN_COMMAND');
  check(Object.keys(options).every(key => key === 'origin' || allowed.includes(key)), 'UNKNOWN_ARGUMENT');
  return { path, body };
}

async function readResponse(response) {
  check(response.body, 'INVALID_RESPONSE');
  const reader = response.body.getReader(); let bytes = 0; const chunks = [];
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 1_048_576) { await reader.cancel(); fail('RESPONSE_TOO_LARGE'); } chunks.push(part.value); }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch { fail('INVALID_RESPONSE'); }
  finally { reader.releaseLock(); }
}

export async function runControlAdmin(argv, dependencies = {}) {
  const { env = process.env, fetcher = fetch, writeOut = text => process.stdout.write(text), interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY),
    readEvidenceFile = path => readFile(path, 'utf8') } = dependencies;
  if (argv.length === 0 || (argv.length === 1 && ['--help', 'help'].includes(argv[0]))) { writeOut(HELP); return; }
  const { command, options } = flags(argv);
  let origin;
  try { const url = new URL(options.origin); check(url.protocol === 'https:' && !url.username && !url.password && url.origin === options.origin, 'INVALID_ORIGIN'); origin = url.origin; }
  catch { fail('INVALID_ORIGIN'); }
  const secret = env.CONTROL_ADMIN_SECRET;
  check(typeof secret === 'string' && secret.length >= 32 && secret.length <= 4096 && !/\s|local-test|placeholder|example|changeme/i.test(secret), 'ADMIN_SECRET_REQUIRED');
  const { path, body } = await commandRequest(command, options, interactive, readEvidenceFile);
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 30_000); timer.unref?.();
  try {
    let response;
    try { response = await fetcher(`${origin}/api/v1/admin/${path}`, { method: 'POST', redirect: 'manual', signal: abort.signal,
      headers: { Authorization: `Bearer ${secret}`, Origin: origin, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }); }
    catch { fail('ADMIN_REQUEST_UNCERTAIN_NO_RETRY'); }
    check(!response.redirected && response.status >= 200 && response.status < 300 && response.type !== 'opaqueredirect', `ADMIN_HTTP_${response.status}_NO_RETRY`);
    const result = await readResponse(response);
    if (command === 'report') writeOut(JSON.stringify(safeAdminReport(result), null, 2) + '\n');
    else if (command === 'issue' || command === 'reissue') {
      check(record(result) && typeof result.code === 'string' && /^[a-f\d]{64}$/i.test(result.code) && typeof result.inviteId === 'string' && /^[a-f\d]{64}$/i.test(result.inviteId));
      if (command === 'reissue') check(id(result.subjectId) && result.subjectId === body.subjectId && integer(result.expiresAt));
      writeOut('Invitation code displayed explicitly in this terminal; do not log or share the admin secret. No code file is written.\n');
      writeOut(JSON.stringify({ code: result.code, inviteId: result.inviteId, ...(command === 'reissue' ? { subjectId: result.subjectId, expiresAt: result.expiresAt } : {}) }, null, 2) + '\n');
    } else { check(record(result) && result.ok === true); writeOut(JSON.stringify({ ok: true, command }) + '\n'); }
  } catch (error) {
    if (command !== 'report' && error instanceof Error && ['INVALID_RESPONSE', 'RESPONSE_TOO_LARGE'].includes(error.message)) fail('ADMIN_RESULT_UNCERTAIN_NO_RETRY');
    throw error;
  } finally { clearTimeout(timer); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runControlAdmin(process.argv.slice(2)).catch(error => {
    const code = error instanceof Error && /^[A-Z_\d]{1,96}$/.test(error.message) ? error.message : 'ADMIN_COMMAND_FAILED';
    process.stderr.write(code + '\n'); process.exitCode = 1;
  });
}
