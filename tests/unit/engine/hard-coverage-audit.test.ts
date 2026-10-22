import { readFileSync, existsSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { hardCheckCoverage } from '../../../src/engine/hard-checks';
import { engineChangeSchema, engineItemSchema, prescriptionSchema } from '../../../src/engine/contracts';
import { runGates } from '../../../src/engine/gates';
import { assistantIntentSchema, type AssistantRequest } from '../../../src/assistant/contracts';
import { sessionTemplateSchema } from '../../../src/coach/contracts';
import { assembleEngineIntent } from '../../../src/backend/assistant/engine-assemble';
import * as application from '../../../src/application/engine-plan';
import { fixtureProfile, planFixture } from './fixtures';
const root = new URL('../../../', import.meta.url),
  read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const document = read('docs/training-engine/hard-rule-coverage.md'),
  rows = document
    .split('\n')
    .filter(line => /^\| `[^`]+` \|/.test(line))
    .map(line =>
      line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim()),
    ),
  rules = new Rules();
afterEach(() => vi.restoreAllMocks());
// These are inventory/evidence-link checks, never certification that a source rule is implemented.
it('retains original95 as original93 hard and two user-deferred rows, separately accounting for the new active hard gate', () => {
  const active = rules.data.rules.filter(rule => rule.severity === 'hard').map(rule => rule.id),
    deferredIds = ['pregnancy.hiit', 'caution.progression'],
    originalActive = active.filter(id => !['caution.progression_gate', 'pregnancy.inactive.ramp'].includes(id));
  expect(active).toHaveLength(95);
  expect(originalActive).toHaveLength(93);
  expect(rows).toHaveLength(95);
  const ids = rows.map(row => row[0].replaceAll('`', ''));
  expect(new Set(ids).size).toBe(95);
  expect(ids.sort()).toEqual([...originalActive, ...deferredIds].sort());
  expect(ids).not.toContain('caution.progression_gate');
  for (const id of deferredIds) {
    expect(rules.byId.get(id)).toMatchObject({
      severity: 'mechanic',
      deferred: true,
    });
    expect(rows.find(row => row[0] === '`' + id + '`')![1]).toBe('deferred / 非active');
  }
  expect(rules.byId.get('caution.progression_gate')).toMatchObject({
    type: 'limit',
    severity: 'hard',
  });
  expect(document).toContain('原始93');
  expect(document).toContain('新增2');
});
it('records scope, concrete evidence or an explicit gap for every row without declaring ID registration complete', () => {
  for (const row of rows) {
    expect(row).toHaveLength(5);
    expect(row.every(cell => cell.length > 0)).toBe(true);
    expect(row[1]).toMatch(/^(partial|gap|history|runtime|deferred)/);
    expect(row[4]).not.toMatch(/^(完成|complete|通过)$/);
  }
  expect(hardCheckCoverage.complete).toBe(true);
  expect(document).toContain('清单一致性测试仅防漏项/漂移，不认证行为');
});
it('links reviewed literal test names to real behavioral tests instead of inventing evidence titles', () => {
  const paths: Record<string, string> = {
    G: 'tests/unit/engine/a-structure.test.ts',
    S: 'tests/training-engine/screening-clearance.test.ts',
    R: 'tests/training-engine/redflag-guard.test.ts',
    P: 'tests/unit/training-engine-pain.test.ts',
    H: 'tests/unit/engine/b-hiit-advisory-proof.test.ts',
    U: 'tests/unit/engine/hard-coverage-audit.test.ts',
  };
  for (const row of rows)
    for (const part of row[3].split('；')) {
      const anchor = /^([GSRPHU])：(.+)$/.exec(part);
      if (anchor) expect(read(paths[anchor[1]]).includes(anchor[2]), `${row[0]}: ${anchor[2]}`).toBe(true);
    }
  for (const path of [
    ...Object.values(paths),
    'tests/unit/engine/d-hard-matrix.test.ts',
    'tests/unit/engine/d-hard-common.test.ts',
    'tests/unit/engine/power-load-branches.test.ts',
  ])
    expect(existsSync(new URL(path, root))).toBe(true);
});
it('keeps extra conditional/structural invariants outside the original active-hard count', () => {
  expect(rows.some(row => row[0] === '`older.template.balance_required`')).toBe(false);
  expect(document).toContain('原95之外的硬不变量');
  expect(document).toContain('合法动作存在却漏排不可豁免');
});
it.each([17, 18])('enforces the exact authored age boundary: %s', ageYears => {
  expect(rules.get('safety.scope.age_min').age_min_years).toBe(18);
  const p = { ...fixtureProfile, birthYearMonth: undefined, ageYears },
    g = runGates(p, rules),
    age = g.reasons.find(reason => reason.ruleId === 'safety.scope.age_min');
  expect(age?.status).toBe(ageYears < 18 ? 'blocked' : 'pass');
});
it.each(['drop_set', 'rest_pause'])(
  'rejects unsupported intensity technique prescriptions and mutation operations: %s',
  technique => {
    expect(rules.get('dose.intensity_techniques').allowed).toContain(technique);
    const plan = planFixture(),
      item = plan.templates[0].items[0],
      pres = item.prescription!;
    expect(prescriptionSchema.safeParse({ ...pres, intensityTechnique: technique }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ ...pres, trainingStyle: technique }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ ...pres, structure: technique }).success).toBe(false);
    expect(
      engineItemSchema.safeParse({
        ...item,
        sets: rules.get('dose.intensity_techniques').counts_as_sets,
      }).success,
    ).toBe(false);
    expect(engineChangeSchema.safeParse({ op: technique }).success).toBe(false);
    expect(
      assistantIntentSchema.safeParse({
        kind: 'plan_modify',
        changes: [{ op: technique }],
      }).success,
    ).toBe(false);
    const invalid = structuredClone(plan.templates[0]);
    Object.assign(invalid.items[0].prescription!, {
      intensityTechnique: technique,
    });
    expect(sessionTemplateSchema.safeParse(invalid).success).toBe(false);
  },
);
it.each(['drop_set', 'rest_pause'])(
  'does not project passthrough AI technique metadata into an engine mutation: %s',
  technique => {
    const id = '11111111-1111-4111-8111-111111111111',
      template = planFixture().templates[0],
      intent = assistantIntentSchema.parse({
        kind: 'plan_modify',
        changes: [
          {
            op: 'set_volume',
            session: template.id,
            from: template.items[0].exerciseId,
            sets: 2,
            intensityTechnique: technique,
          },
        ],
      });
    const request: AssistantRequest = {
      version: 'fitness-assistant-v2',
      requestId: id,
      conversationId: id,
      locale: 'zh',
      timeZone: 'Asia/Shanghai',
      adultConfirmed: true,
      messages: [],
      context: {
        version: 'fitness-coach-v8',
        requestId: id,
        conversationId: id,
        restoreGeneration: 0,
        inputSnapshot: 'independent-hard-boundary',
        sendConfirmation: 'local',
        locale: 'zh',
        timeZone: 'Asia/Shanghai',
        adultConfirmed: true,
        messages: [],
        trainingEngine: true,
        engineProfile: fixtureProfile,
        task: 'MODIFY_PLAN',
        instruction: '调整组数',
        target: { planId: id, versionId: id, revision: 0 },
        plan: {
          goalText: '保持活动',
          scheduleOriginalText: '每周一次',
          weeklyTarget: 1,
          sessionMinutes: 30,
          templates: [template],
          reasons: ['本地', '本地', '本地'],
        },
      },
    };
    const action = vi.spyOn(application, 'engineAction').mockReturnValue({ noop: true, notices: [] });
    expect(assembleEngineIntent(intent, request).attachment).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
    const mutation = action.mock.calls[0][2];
    expect(mutation.kind).toBe('modify');
    if (mutation.kind !== 'modify') throw Error('Expected only the allowed volume mutation');
    expect(mutation.changes).toHaveLength(1);
    expect(mutation.changes[0]).toMatchObject({ op: 'set_volume', sets: 2 });
    expect(mutation.changes[0]).not.toHaveProperty('intensityTechnique');
    expect(engineChangeSchema.safeParse(mutation.changes[0]).success).toBe(true);
  },
);
