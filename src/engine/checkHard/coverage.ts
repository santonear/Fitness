import coverageAudit from '../../../data/training-engine/hard-coverage-audit.json' with { type: 'json' };
import { Rules } from '../data';
/** Auditable scope: gate/trigger and history-only hard rules remain the A/runtime owners.
 * Complete refers to the reviewed supported source version; deferred paths are explicitly excluded. */
const coverageSource = new Rules(),
  activeSourceIds = coverageSource.data.rules.filter(rule => rule.severity === 'hard').map(rule => rule.id);
export const hardCheckCoverage = {
  complete:
    coverageSource.data.rulesVersion === coverageAudit.rulesVersion &&
    activeSourceIds.length === coverageAudit.activeRuleIds.length &&
    activeSourceIds.every(id => coverageAudit.activeRuleIds.includes(id)),
  deferredRuleIds: coverageAudit.deferredRuleIds,
  deferredBranches: coverageAudit.deferredBranches,
  evidence: coverageAudit.evidence,
  ruleIds: [
    'safety.clearance.restricted_mode',
    'safety.hypertension.limits',
    'safety.unlock.vigorous',
    'dose.power',
    'fatloss.spot_reduction.ban',
    'older.hypertension',
    'postpartum.doming',
    'postpartum.symptom_regression',
    'goal.strength.beginner_rep_gate',
    'dose.sets_session.cap',
    'dose.reps.bounds',
    'variety.no_repeat',
    'ladder.gate.barbell',
    'progression.new.week_caps',
    'progression.new.exclusions',
    'caution.knee.filter',
    'caution.back.filter',
    'caution.shoulder.filter',
    'caution.wrist.filter',
    'caution.hip.filter',
    'caution.ankle.filter',
    'caution.neck.filter',
    'older.exclude.base',
    'older.exclude.balance_cautious',
    'older.floor.transitions',
    'older.bone',
    'older.strength.dose',
    'pregnancy.exclude.supine',
    'pregnancy.exclude.prone',
    'pregnancy.exclude.impact',
    'pregnancy.exclude.fall_risk',
    'pregnancy.exclude.valsalva',
    'pregnancy.exclude.abdominal_flexion',
    'pregnancy.intensity',
    'postpartum.gate.caesarean',
    'postpartum.exclude.pre_phase3',
    'postpartum.running.readiness',
    'duration.fit.bounds',
  ],
  gateResponsibility: 'A owns profile admission and event triggers; D checks resultant plan restrictions.',
  additionalInvariantRuleIds: [
    'select.pipeline',
    'dose.load.initial_selection',
    'older.template.balance_required',
    'duration.rest.block',
    'dose.isometric',
    'dose.stretch',
  ],
} as const;

/** One row per authored hard rule; rule presence is never a completeness claim. */
export function hardRuleAssessments(rules = new Rules()) {
  const plan = new Set<string>([
    ...hardCheckCoverage.ruleIds,
    'dose.power',
    'fatloss.spot_reduction.ban',
    'older.hypertension',
    'postpartum.doming',
    'postpartum.symptom_regression',
  ]);
  const history = new Set([
    'progression.new.load_step',
    'progression.return.first_session_cap',
    'caution.progression_gate',
    'older.strength.progression',
    'older.return_after_break',
    'postpartum.risk_modifiers',
  ]);
  const runtime = new Set([
    'dose.intensity_techniques',
    'hiit.gate.unlock',
    'pregnancy.hiit',
    'caution.knee.substitute',
    'caution.back.substitute',
    'caution.shoulder.substitute',
    'caution.wrist.substitute',
    'caution.hip.substitute',
    'caution.ankle.substitute',
    'caution.neck.substitute',
    'pregnancy.substitute',
    'older.power.gate',
    'pregnancy.environment',
    'older.intensity.aerobic',
    'caution.never',
    'older.never',
    'pregnancy.never',
    'postpartum.never',
  ]);
  return rules.data.rules
    .filter(rule => rule.severity === 'hard')
    .map(rule => ({
      ruleId: rule.id,
      owner: plan.has(rule.id) ? 'D' : rule.type === 'trigger' || rule.type === 'gate' ? 'A' : 'runtime',
      status:
        rules.data.rulesVersion !== coverageAudit.rulesVersion || !coverageAudit.activeRuleIds.includes(rule.id)
          ? 'unreviewed'
          : plan.has(rule.id)
            ? 'plan-validated'
            : history.has(rule.id)
              ? 'history-validated'
              : runtime.has(rule.id)
                ? 'runtime-validated'
                : rule.type === 'trigger'
                  ? 'event-validated'
                  : rule.type === 'gate'
                    ? 'gate-validated'
                    : 'source-validated',
      evidence: coverageAudit.activeRuleIds.includes(rule.id)
        ? coverageAudit.evidence + ' :: ' + rule.id
        : 'no behavioral audit evidence',
    }));
}
