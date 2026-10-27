import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileRules, extractCopy, resolveRuleReference } from './compile-rules.ts';
import { compileAnnotations, validateAnnotations } from './compile-annotations.ts';

const rules = await compileRules();
// Includes approved screening/power/pregnancy copy and household-support source data.
// This inventory count does not represent hard-rule implementation coverage.
const previewApprovedIds = new Set([
  'duration.cardio.cap',
  'session.copy.intentional_short',
  'pregnancy.inactive.ramp',
  'pregnancy.copy.long_session',
  // Bo 2026-10-26: yoga as its own goal.
  'goal.params.yoga',
  'week.day.yoga',
]);
const externalRules = rules.rules.filter(rule => !rule.sources.includes('INTERNAL:codex-prompt-training-engine'));
assert.equal(externalRules.filter(rule => !previewApprovedIds.has(rule.id)).length, 327);
assert.equal(externalRules.length, 333);
for (const id of previewApprovedIds) assert.equal(externalRules.filter(rule => rule.id === id).length, 1);
assert.equal(rules.rules.find(rule => rule.id === 'duration.cardio.cap')?.severity, 'mechanic');
assert.equal(rules.rules.find(rule => rule.id === 'session.copy.intentional_short')?.severity, 'copy');
assert.equal(rules.rules.find(rule => rule.id === 'pregnancy.inactive.ramp')?.severity, 'hard');
assert.equal(rules.rules.find(rule => rule.id === 'pregnancy.copy.long_session')?.severity, 'copy');
assert.equal(rules.copy['meta.copy.load_light'].zh, '轻重量');
const parqZh = [
  '医生是否说过你有心脏问题或高血压',
  '休息时、日常活动时或运动时是否胸痛',
  '过去 12 个月是否因头晕失去平衡或失去意识（因呼吸过快导致的头晕除外）',
  '是否被诊断过其他慢性疾病',
  '是否在为慢性疾病服用处方药',
  '现在（或过去 12 个月内）是否有骨骼、关节或软组织问题，可能因活动增加而加重',
  '医生是否说过你只能在医学监督下运动',
];
assert.deepEqual(
  parqZh.map((_, index) => rules.copy[`safety.copy.parq_${index + 1}`].zh),
  parqZh,
);
assert.match(rules.copy['safety.copy.parq_2'].en, /chest pain/);
assert.match(rules.copy['safety.copy.parq_3'].en, /lost consciousness/);
assert.equal(
  (rules.rules.find(rule => rule.id === 'progression.new.weekly_sets')?.value as { week_1_min?: number } | undefined)
    ?.week_1_min,
  4,
);
assert.ok(resolveRuleReference('goal.params', rules.rules));
assert.ok(resolveRuleReference('dose.rest.table.heavy_compound_reps_le_6', rules.rules));
assert.equal(resolveRuleReference('dose.missing.rule', rules.rules), false);
assert.equal(rules.copy['pain.copy.referral'].sourceRuleId, 'pain.copy');
assert.equal(rules.copy['pregnancy.pelvic_floor.copy'].sourceRuleId, 'pregnancy.pelvic_floor');
assert.deepEqual(extractCopy(rules.rules), rules.copy);
const data = await compileAnnotations();
assert.equal(data.counts.repdb, 637);
assert.equal(data.counts.native, 3);
assert.deepEqual(data.exercises.find(row => row.slug === 'native-goblet-squat')?.equipment_required, ['dumbbell']);
assert.equal(data.exercises.find(row => row.slug === 'custom-wall-plank')?.requires_floor_transition, false);
assert.equal(new Set(data.exercises.map(row => row.id)).size, data.exercises.length);
assert.ok(data.exercises.every(row => row.name?.zh && row.name?.en));
const annotation = JSON.parse(await readFile('data/training-engine/native-annotations.json', 'utf8'))[0];
assert.throws(() => validateAnnotations([{ ...annotation, primary_pattern: 'invented' }]));
assert.throws(() => validateAnnotations([annotation, annotation]));
const before = await readFile('src/engine/generated/exercise-index.json', 'utf8');
await compileAnnotations();
assert.equal(await readFile('src/engine/generated/exercise-index.json', 'utf8'), before);
console.log(
  'Training data checks: references, copy provenance, invalid enums, duplicate IDs, catalog join and deterministic compilation passed.',
);
