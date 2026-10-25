import baseline from '../fixtures/training-engine/original-rule-grading.json';
import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
const compilerPath = '../../tools/training-engine/compile-rules';
const { mergeRuleSeverity, ruleSchema } = await import(compilerPath);

const rule = (id = 'test.safety') =>
  ruleSchema.parse({
    id,
    chapter: 0,
    type: 'limit',
    evidence: 'C',
    sources: ['synthetic-test'],
    value: { maximum: 3 },
  });
const document = (rules: unknown[]) => ({
  version: 'severity-v1',
  definitions: {
    hard: 'hard',
    target: 'target',
    advice: 'advice',
    mechanic: 'mechanic',
    copy: 'copy',
    meta: 'meta',
  },
  overrides: {},
  rules,
});
it('requires an exact, unique severity row for every rule ID', () => {
  expect(() => mergeRuleSeverity([rule()], document([]))).toThrow(/Missing severity/);
  expect(() =>
    mergeRuleSeverity(
      [rule()],
      document([
        { id: 'test.safety', type: 'limit', severity: 'hard' },
        { id: 'test.safety', type: 'limit', severity: 'hard' },
      ]),
    ),
  ).toThrow(/Duplicate severity/);
  expect(() =>
    mergeRuleSeverity(
      [rule()],
      document([
        { id: 'test.safety', type: 'limit', severity: 'hard' },
        { id: 'test.extra', type: 'limit', severity: 'hard' },
      ]),
    ),
  ).toThrow(/Unknown severity/);
});
it('validates levels, source type and positive target weights', () => {
  for (const row of [
    { severity: 'invalid' },
    { severity: 'target' },
    { severity: 'target', weight: 0 },
    { severity: 'target', weight: -1 },
    { severity: 'target', weight: Infinity },
    { severity: 'hard', type: 'gate' },
  ])
    expect(() => mergeRuleSeverity([rule()], document([{ id: 'test.safety', type: 'limit', ...row }]))).toThrow();
  const source = rule(),
    merged = mergeRuleSeverity([source], document([{ id: source.id, type: 'limit', severity: 'target', weight: 4 }]));
  expect(merged[0]).toEqual({ ...source, severity: 'target', weight: 4 });
  expect(source).not.toHaveProperty('severity');
});
it('pins all original351 grading rows and only the explicitly approved deferred classifications', async () => {
  const doc = parse(await readFile('data/training-engine/rules/severity.yaml', 'utf8')),
    ids = new Set(baseline.rules.map(rule => rule.id)),
    deferred = new Set(['pregnancy.hiit', 'caution.progression']);
  expect(baseline.rules).toHaveLength(351);
  expect(ids.size).toBe(351);
  const original = doc.rules.filter((rule: { id: string }) => ids.has(rule.id));
  expect(original).toHaveLength(351);
  for (const row of baseline.rules) {
    const current = original.find((r: { id: string }) => r.id === row.id);
    expect(current, row.id).toEqual({
      ...row,
      ...(deferred.has(row.id) ? { severity: 'mechanic' } : {}),
    });
  }
  expect(
    original.reduce(
      (all: Record<string, number>, rule: { severity: string }) => ({
        ...all,
        [rule.severity]: (all[rule.severity] ?? 0) + 1,
      }),
      {},
    ),
  ).toEqual({
    hard: 93,
    target: 38,
    advice: 15,
    mechanic: 123,
    copy: 79,
    meta: 3,
  });
  const additions = doc.rules.filter((rule: { id: string }) => !ids.has(rule.id));
  // 2026-10-25 Bo approved hip, ankle and neck: 6 caution rules, 3 red-flag gates and 6 question copies.
  expect(additions).toHaveLength(41);
  expect(new Set(doc.rules.map((rule: { id: string }) => rule.id)).size).toBe(392);
  expect(
    additions.filter((rule: { id: string }) =>
      ['duration.cardio.cap', 'session.copy.intentional_short'].includes(rule.id),
    ),
  ).toEqual([
    { id: 'duration.cardio.cap', type: 'limit', severity: 'mechanic' },
    { id: 'session.copy.intentional_short', type: 'copy', severity: 'copy' },
  ]);
  expect(additions.filter((rule: { severity: string }) => rule.severity === 'hard')).toEqual([
    { id: 'caution.hip.filter', type: 'exclude', severity: 'hard' },
    { id: 'caution.hip.substitute', type: 'substitute', severity: 'hard' },
    { id: 'caution.ankle.filter', type: 'exclude', severity: 'hard' },
    { id: 'caution.ankle.substitute', type: 'substitute', severity: 'hard' },
    { id: 'caution.neck.filter', type: 'exclude', severity: 'hard' },
    { id: 'caution.neck.substitute', type: 'substitute', severity: 'hard' },
    { id: 'redflag.hip', type: 'gate', severity: 'hard' },
    { id: 'redflag.ankle', type: 'gate', severity: 'hard' },
    { id: 'redflag.neck', type: 'gate', severity: 'hard' },
    { id: 'caution.progression_gate', type: 'limit', severity: 'hard' },
    { id: 'pregnancy.inactive.ramp', type: 'limit', severity: 'hard' },
  ]);
  expect(Object.keys(doc.overrides)).toHaveLength(9);
});
it('retains grading in both compiled artifacts and stores hard/target duration separately', async () => {
  const full = JSON.parse(await readFile('src/engine/generated/rules.json', 'utf8')),
    runtime = JSON.parse(await readFile('src/engine/generated/rules-runtime.json', 'utf8'));
  expect(full.rules).toHaveLength(392);
  expect(runtime.rulesVersion).toBe(full.rulesVersion);
  for (const rule of full.rules) {
    expect(rule.severity).toBeTruthy();
    expect(runtime.rules.find((r: { id: string }) => r.id === rule.id)).toMatchObject({
      severity: rule.severity,
      ...(rule.severity === 'target' ? { weight: rule.weight } : {}),
    });
  }
  const get = (id: string) => full.rules.find((r: { id: string }) => r.id === id);
  expect(get('duration.fit.bounds')).toMatchObject({
    severity: 'hard',
    value: { duration_band: [0.8, 1.2], min10_duration_seconds: [480, 840] },
  });
  expect(get('duration.fit.tolerance')).toMatchObject({
    severity: 'target',
    weight: 4,
    value: { band: [0.9, 1.1], zero_score_band: [0.8, 1.2] },
  });
  for (const r of full.rules.filter((r: { id: string }) => r.id.startsWith('goal.params.')))
    for (const range of Object.values(r.value.time_share)) expect(range).toEqual([0.3, 0.7]);
  expect(get('older.template.balance_required').value).toMatchObject({
    hard_when_days_available_min: 3,
    hard_balance_days_min: 3,
    balance_items_per_session_min: 1,
  });
  expect(get('session.cooldown.stretch').value).toMatchObject({
    exempt_when_session_minutes_max: 20,
    short_fallback: { exercises: 1, hold_s: [30, 60] },
  });
});
