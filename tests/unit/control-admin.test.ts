import { expect, it, vi } from 'vitest';
const script = '../../scripts/control-admin.mjs';
const { runControlAdmin, safeAdminReport } = await import(script);
const origin = 'https://admin.fixture.test';
const secret = 's'.repeat(40);
const subjectId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const fixtureReport = () => ({ format: 'fitness-control-admin-report', version: 1, capturedAt: '2026-10-06T00:00:00Z', aiEnabled: false, recoveryRequired: false,
  budgets: [{ period: '2026-10', spentFen: 5, reservedFen: 300, secret }], subjects: [{ subjectId, expiresAt: 100, revoked: false, expired: true, token: secret }],
  usages: [{ subjectId, period: '2026-10', understand: 1, generate: 2, text: secret }],
  requests: [{ subjectId, requestId, operation: 'generate', period: '2026-10', boundFen: 300, status: 'pending', cancelled: true, inputDigest: secret }],
  sessions: { [secret]: {} }, adminSecret: secret });

function dependencies(result: unknown = { ok: true }, interactive = false) {
  const output: string[] = [];
  const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(result));
  return { output, fetcher, env: { CONTROL_ADMIN_SECRET: secret }, interactive, writeOut: (text: string) => output.push(text) };
}

it('posts a protected report to the exact explicit origin and prints only whitelisted ledger fields', async () => {
  const deps = dependencies(fixtureReport());
  await runControlAdmin(['report', '--origin', origin], deps);
  expect(deps.fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = deps.fetcher.mock.calls[0];
  expect(url).toBe(`${origin}/api/v1/admin/report`);
  expect(init).toMatchObject({ method: 'POST', redirect: 'manual', body: '{}', headers: { Authorization: `Bearer ${secret}`, Origin: origin } });
  expect(deps.output.join('')).toContain('"reservedFen": 300');
  expect(deps.output.join('')).not.toContain(secret);
  expect(deps.output.join('')).not.toMatch(/sessions|inputDigest|adminSecret/);
});

it('rejects insecure/ambiguous origins, argument secrets and duplicate flags before contacting any endpoint', async () => {
  for (const value of ['http://admin.fixture.test', `${origin}/`, `${origin}/api`, `${origin}?query=x`, 'https://user:password@admin.fixture.test', `${origin}#fragment`]) {
    const deps = dependencies(); await expect(runControlAdmin(['report', '--origin', value], deps)).rejects.toThrow('INVALID_ORIGIN'); expect(deps.fetcher).not.toHaveBeenCalled();
  }
  for (const args of [['report', '--origin', origin, '--secret', secret], ['report', '--origin', origin, '--origin', origin]]) {
    const deps = dependencies(); await expect(runControlAdmin(args, deps)).rejects.toThrow(); expect(deps.fetcher).not.toHaveBeenCalled(); expect(deps.output).toEqual([]);
  }
  const deps = dependencies(); await expect(runControlAdmin(['report', '--origin', origin], { ...deps, env: {} })).rejects.toThrow('ADMIN_SECRET_REQUIRED'); expect(deps.fetcher).not.toHaveBeenCalled();
});

it('requires provider bill confirmation and transmits only the existing settle contract', async () => {
  const args = ['settle', '--origin', origin, '--subject-id', subjectId, '--request-id', requestId, '--actual-cost-fen', '0'];
  const absent = dependencies(); await expect(runControlAdmin(args, absent)).rejects.toThrow('PROVIDER_BILL_CONFIRMATION_REQUIRED'); expect(absent.fetcher).not.toHaveBeenCalled();
  const deps = dependencies(); await runControlAdmin([...args, '--evidence-ref', 'provider-ledger-reference', '--confirm-provider-bill'], deps);
  expect(JSON.parse(deps.fetcher.mock.calls[0][1]!.body as string)).toEqual({ subjectId, requestId, actualCost: 0 });
  expect(deps.output.join('')).not.toContain('provider-ledger-reference');
  for (const cost of ['0.1', '-1', '01', '9007199254740992', 'NaN']) {
    const bad = dependencies(); await expect(runControlAdmin(['settle', '--origin', origin, '--subject-id', subjectId, '--request-id', requestId, '--actual-cost-fen', cost, '--evidence-ref', 'bill', '--confirm-provider-bill'], bad)).rejects.toThrow('INVALID_ACTUAL_COST'); expect(bad.fetcher).not.toHaveBeenCalled();
  }
});

it('validates a local reconciliation file and never uploads its reference/path or reads files for unknown flags', async () => {
  const deps = dependencies();
  const evidence = { budgets: { '2026-10': 5 }, usages: { [`${subjectId}:2026-10`]: { understand: 1, generate: 2 } } };
  const readEvidenceFile = vi.fn(async () => JSON.stringify(evidence));
  await runControlAdmin(['reconciled', '--origin', origin, '--evidence-file', 'local-bill.json', '--evidence-ref', 'independent-bill', '--confirm-provider-bill'], { ...deps, readEvidenceFile });
  expect(readEvidenceFile).toHaveBeenCalledWith('local-bill.json');
  expect(JSON.parse(deps.fetcher.mock.calls[0][1]!.body as string)).toEqual(evidence);
  expect(deps.output.join('')).not.toMatch(/local-bill|independent-bill/);
  const unknown = dependencies(); const unread = vi.fn(async () => JSON.stringify(evidence));
  await expect(runControlAdmin(['reconciled', '--origin', origin, '--evidence-file', 'local.json', '--evidence-ref', 'bill', '--confirm-provider-bill', '--unknown', 'value'], { ...unknown, readEvidenceFile: unread })).rejects.toThrow('UNKNOWN_ARGUMENT');
  expect(unread).not.toHaveBeenCalled(); expect(unknown.fetcher).not.toHaveBeenCalled();
  const bad = dependencies(); await expect(runControlAdmin(['reconciled', '--origin', origin, '--evidence-file', 'bad.json', '--evidence-ref', 'bill', '--confirm-provider-bill'], {
    ...bad, readEvidenceFile: async () => JSON.stringify({ ...evidence, secret }),
  })).rejects.toThrow('INVALID_RECONCILIATION_EVIDENCE'); expect(bad.fetcher).not.toHaveBeenCalled();
});

it('never issues or reissues an inaccessible/loggable code without explicit interactive display', async () => {
  for (const command of ['issue', 'reissue']) {
    const args = [command, '--origin', origin, ...(command === 'reissue' ? ['--subject-id', subjectId] : [])];
    const deps = dependencies(); await expect(runControlAdmin(args, deps)).rejects.toThrow('INTERACTIVE_CODE_DISPLAY_REQUIRED');
    await expect(runControlAdmin([...args, '--show-code'], deps)).rejects.toThrow('INTERACTIVE_CODE_DISPLAY_REQUIRED'); expect(deps.fetcher).not.toHaveBeenCalled();
  }
  const code = 'c'.repeat(64); const inviteId = 'd'.repeat(64);
  const deps = dependencies({ code, inviteId, adminSecret: secret }, true);
  await runControlAdmin(['issue', '--origin', origin, '--show-code'], deps);
  expect(deps.output.join('')).toContain(code); expect(deps.output.join('')).not.toContain(secret);
});

it('does not follow redirects, retry uncertain mutations or print private error bodies', async () => {
  const deps = dependencies(); const fetcher = vi.fn(async () => new Response(secret, { status: 302, headers: { Location: 'https://other.test' } }));
  await expect(runControlAdmin(['revoke', '--origin', origin, '--subject-id', subjectId], { ...deps, fetcher })).rejects.toThrow('ADMIN_HTTP_302_NO_RETRY');
  expect(fetcher).toHaveBeenCalledTimes(1); expect(deps.output).toEqual([]);
  const failed = vi.fn(async () => { throw new Error(secret); });
  await expect(runControlAdmin(['revoke', '--origin', origin, '--subject-id', subjectId], { ...deps, fetcher: failed })).rejects.toThrow('ADMIN_REQUEST_UNCERTAIN_NO_RETRY'); expect(failed).toHaveBeenCalledTimes(1);
  const malformed = dependencies({ ok: false, secret });
  await expect(runControlAdmin(['revoke', '--origin', origin, '--subject-id', subjectId], malformed)).rejects.toThrow('ADMIN_RESULT_UNCERTAIN_NO_RETRY'); expect(malformed.fetcher).toHaveBeenCalledTimes(1); expect(malformed.output).toEqual([]);
});

it('keeps recovery explicit and maps revoke/reissue commands without model endpoints', async () => {
  const deps = dependencies(); await expect(runControlAdmin(['recovery', '--origin', origin], deps)).rejects.toThrow('RECOVERY_CONFIRMATION_REQUIRED');
  await runControlAdmin(['recovery', '--origin', origin, '--confirm-recovery'], deps);
  await runControlAdmin(['revoke-invite', '--origin', origin, '--invite-id', 'd'.repeat(64)], deps);
  expect(deps.fetcher.mock.calls.map(([url]) => url)).toEqual([`${origin}/api/v1/admin/recovery`, `${origin}/api/v1/admin/invites/revoke`]);
  const replacement = dependencies({ code: 'c'.repeat(64), inviteId: 'd'.repeat(64), subjectId, expiresAt: 100 }, true);
  await runControlAdmin(['reissue', '--origin', origin, '--subject-id', subjectId, '--show-code'], replacement);
  expect(replacement.fetcher.mock.calls[0][0]).toBe(`${origin}/api/v1/admin/reissue`);
});

it('rejects malformed reported fields instead of printing attacker-controlled strings', () => {
  expect(() => safeAdminReport({ ...fixtureReport(), capturedAt: secret })).toThrow('INVALID_RESPONSE');
  expect(() => safeAdminReport({ ...fixtureReport(), requests: [{ ...fixtureReport().requests[0], requestId: secret }] })).toThrow('INVALID_RESPONSE');
});
it('supports summary metadata and evidence without printing result bodies',async()=>{
 const report=fixtureReport();const extended={...report,usages:[{...report.usages[0],summary:2}],requests:[{...report.requests[0],operation:'summary',result:secret}]};
 const safe=safeAdminReport(extended);expect(safe.usages[0].summary).toBe(2);expect(safe.requests[0].operation).toBe('summary');expect(JSON.stringify(safe)).not.toContain(secret);
 const deps=dependencies();const evidence={budgets:{'2026-10':5},usages:{[`${subjectId}:2026-10`]:{understand:1,generate:2,summary:2}}};
 await runControlAdmin(['reconciled','--origin',origin,'--evidence-file','fixture.json','--evidence-ref','bill','--confirm-provider-bill'],{...deps,readEvidenceFile:async()=>JSON.stringify(evidence)});
 expect(JSON.parse(deps.fetcher.mock.calls[0][1]!.body as string)).toEqual(evidence);
});
