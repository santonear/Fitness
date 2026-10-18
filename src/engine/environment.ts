import type {
  EnginePlan,
  EngineProfile,
  GateOutcome,
  ValidationIssue,
  Pattern,
} from "./contracts";
import { Rules, condition } from "./data";
import { runGates } from "./gates";
import { isHardEligible } from "./candidates";
import { checkHard } from "./hard-checks";
export interface EnvironmentCoverageProof {
  ruleId: string;
  patterns: Pattern[];
  issueCodes: string[];
  warningCode: string;
  noticeKey: string;
}
/** Recompute both complete pools; no plan marker or validation result is evidence. */
export function proveEnvironmentCoverage(
  profile: EngineProfile,
  gate: GateOutcome,
  rules: Rules,
  ruleId: string,
): EnvironmentCoverageProof | undefined {
  const rule = rules.byId.get(ruleId),
    config = rule?.value?.environment_exception,
    relax = config?.relax;
  if (
    gate.status === "blocked" ||
    config?.kind !== "coverage" ||
    !Array.isArray(config.patterns) ||
    !config.patterns.length ||
    !Array.isArray(config.issue_codes) ||
    !config.issue_codes.length ||
    typeof config.warning_code !== "string" ||
    typeof config.notice_key !== "string" ||
    !rules.data.copy[config.notice_key]
  )
    return;
  if (
    typeof rule?.value?.hard_when_days_available_min === "number" &&
    profile.daysPerWeek < rule.value.hard_when_days_available_min
  )
    return;
  if (
    rule?.applies?.population &&
    !rule.applies.population.includes(gate.restrictions.population)
  )
    return;
  const candidates = rules.data.exercises.filter((e) =>
    config.patterns.includes(e.primary_pattern),
  );
  if (
    !candidates.length ||
    !candidates.every((e) =>
      condition(config.when, e, {
        ...gate.restrictions.user,
        place: profile.place,
        household_support: profile.householdSupport,
      }),
    )
  )
    return;
  // This capability can only add environment access, never change clinical facts or preferences.
  if (
    !relax ||
    Object.keys(relax).some(
      (key) => !["equipment", "space", "householdSupport"].includes(key),
    ) ||
    (relax.equipment !== undefined && relax.equipment !== "all_catalogue") ||
    (relax.householdSupport !== undefined && relax.householdSupport !== true) ||
    (relax.space !== undefined &&
      !["mat", "small", "medium", "large"].includes(relax.space))
  )
    return;
  if (candidates.some((e) => isHardEligible(e, profile, gate, { rules })))
    return;
  const relaxed: EngineProfile = {
      ...profile,
      ...(relax.equipment
        ? {
            equipment: [
              ...new Set([
                ...profile.equipment,
                ...rules.data.exercises.flatMap((e) => e.equipment_required),
              ]),
            ] as EngineProfile["equipment"],
          }
        : {}),
      ...(relax.householdSupport ? { householdSupport: true } : {}),
      constraints: {
        ...profile.constraints,
        ...(relax.space ? { space: relax.space } : {}),
      },
    },
    relaxedGate = runGates(relaxed, rules);
  if (
    !candidates.some((e) => isHardEligible(e, relaxed, relaxedGate, { rules }))
  )
    return;
  return {
    ruleId,
    patterns: [...config.patterns],
    issueCodes: [...config.issue_codes],
    warningCode: config.warning_code,
    noticeKey: config.notice_key,
  };
}
/** Keep the existing claim shape; issueCodes identify the missing requirement, not the warning label. */
export function missingEnvironmentTypes(
  plan: EnginePlan,
  profile: EngineProfile,
  gate: GateOutcome,
  rules: Rules,
  issues: ValidationIssue[],
) {
  if (
    gate.status === "blocked" ||
    !plan.templates.length ||
    plan.templates.some((t) => !t.items.length)
  )
    return [];
  const proofs = rules.data.rules.flatMap((rule) => {
    const config = rule.value?.environment_exception;
    if (
      !config ||
      !issues.some(
        (issue) =>
          issue.ruleId === rule.id &&
          (config.issue_codes.includes(issue.code) ||
            issue.code === config.warning_code),
      )
    )
      return [];
    const proof = proveEnvironmentCoverage(profile, gate, rules, rule.id);
    return proof ? [proof] : [];
  });
  if (
    issues.some(
      (issue) =>
        issue.severity === "error" &&
        !proofs.some(
          (proof) =>
            proof.ruleId === issue.ruleId &&
            proof.issueCodes.includes(issue.code),
        ),
    )
  )
    return [];
  return proofs.map(({ ruleId, patterns, issueCodes }) => ({
    ruleId,
    patterns,
    issueCodes,
  }));
}
/** Re-prove exceptions from current inputs; a stored claim alone never grants application. */
export function applicableEnginePlan(
  plan: EnginePlan,
  profile: EngineProfile,
): boolean {
  const rules = new Rules(),
    gate = runGates(profile, rules);
  if (
    gate.status === "blocked" ||
    plan.meta.engineVersion.includes("stub") ||
    !plan.templates.length ||
    plan.templates.some((t) => !t.items.length)
  )
    return false;
  const issues = [
      ...checkHard(plan, profile, gate, rules),
      ...(plan.quality?.issues ?? []),
    ],
    claims = missingEnvironmentTypes(plan, profile, gate, rules, issues);
  if (claims.length)
    return (
      plan.quality?.status === "environmentLimited" &&
      plan.quality.basis === "environment_constraint"
    );
  return (
    !issues.some((i) => i.severity === "error") &&
    plan.quality?.status !== "unavailable"
  );
}

/** Source-scoped absence is a warning, never permission to forgive a safety violation. */
export function pregnancyEnvironmentIssues(
  p: EngineProfile,
  g: GateOutcome,
  r: Rules,
): ValidationIssue[] {
  const proof = proveEnvironmentCoverage(
    p,
    g,
    r,
    "pregnancy.exclude.fall_risk",
  );
  return proof
    ? [
        {
          code: proof.warningCode,
          ruleId: proof.ruleId,
          severity: "warning",
          reason:
            "complete legal balance pool empty only because support is unavailable",
        },
      ]
    : [];
}
