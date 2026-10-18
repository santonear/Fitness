import {
  intentionalShortFacts,
  pregnancyRampFacts,
} from "./training-engine-shortage";
import {
  digest,
  sourceFingerprint,
  runtimeFingerprint,
  EVIDENCE_VERSION,
} from "../training-engine/evidence";
import { parallelProfiles } from "./training-engine-audit-pool";
import { performance } from "node:perf_hooks";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { generatePlan, validatePlan } from "../../src/engine";
import type {
  EnginePlan,
  EngineProfile,
  ValidationIssue,
  ScoreResult,
} from "../../src/engine/contracts";
import { Rules } from "../../src/engine/data";
import { estimateMinutes } from "../../src/engine/fit";
import { hardCheckCoverage } from "../../src/engine/hard-checks";
import { scorePlan, targetRuleIds } from "../../src/engine/score";
import {
  sampledProfiles,
  extremeProfiles,
  TRAINING_ENGINE_SEED,
} from "./training-engine-profiles";
import { externalIssues } from "./training-engine-invariants";
import {
  independentlyPossibleIds,
  independentBalanceEnvironmentConstraint,
} from "./training-engine-quality";
const rules = new Rules();
/** Only this registered unmet requirement may retain a safe, applicable plan. */
export function verifiedEnvironmentConstraints(
  plan: EnginePlan,
  profile: EngineProfile,
  issues: ValidationIssue[],
) {
  const q = plan.quality,
    claims = q?.environmentConstraints ?? [],
    hard = [...issues, ...(q?.issues ?? [])].filter(
      (i) => i.severity === "error",
    );
  if (
    q?.basis !== "environment_constraint" ||
    q.status !== "environmentLimited" ||
    claims.length !== 1 ||
    !plan.templates.length ||
    plan.templates.some((t) => !t.items.length) ||
    plan.gates.some((g) => g.status === "blocked")
  )
    return [];
  // A source warning is neither proof nor permission to forgive a real hard error.
  if (hard.length) return [];
  const proof = independentBalanceEnvironmentConstraint(profile, rules),
    claim = claims[0];
  if (
    !proof ||
    claim.ruleId !== proof.ruleId ||
    JSON.stringify(claim.patterns) !== JSON.stringify(proof.patterns) ||
    JSON.stringify(claim.issueCodes) !== JSON.stringify(proof.issueCodes)
  )
    return [];
  return claims;
}
export function classifyPlan(
  plan: EnginePlan,
  profile: EngineProfile,
  issues: ValidationIssue[],
) {
  const blocked = plan.gates.some((g) => g.status === "blocked");
  const validBlock =
    blocked &&
    plan.gates
      .filter((g) => g.status === "blocked")
      .every(
        (g) =>
          rules.byId.get(g.ruleId)?.severity === "hard" &&
          /^(safety|older|pregnancy|postpartum|redflag)\./.test(g.ruleId) &&
          !!g.reason,
      ) &&
    plan.notices.some((n) => n.message.zh && n.message.en);
  const constraints = verifiedEnvironmentConstraints(plan, profile, issues),
    errors = [...issues, ...(plan.quality?.issues ?? [])].some(
      (i) => i.severity === "error",
    );
  const environment = constraints.length > 0;
  const claimedEnvironment = plan.quality?.basis === "environment_constraint";
  const status =
    blocked && validBlock && !errors
      ? "blocked"
      : environment
        ? "environment_limited"
        : blocked ||
            claimedEnvironment ||
            !plan.templates.length ||
            plan.templates.some((t) => !t.items.length) ||
            errors ||
            plan.quality?.status === "unavailable"
          ? "fail"
          : "pass";
  return {
    status,
    proof:
      status === "pass" ? "implemented_hard_checks_only" : "diagnostic_status",
    blocked,
    environmentConstraints: constraints,
  };
}
export function classify(profile: EngineProfile) {
  const start = performance.now(),
    plan = generatePlan(profile),
    generationMs = performance.now() - start,
    issues = [...validatePlan(plan, profile), ...externalIssues(plan, profile)];
  return {
    ...classifyPlan(plan, profile, issues),
    plan,
    issues,
    generationMs,
    durationMs: performance.now() - start,
    restricted: plan.gates.some((g) => g.status === "restricted"),
    error: undefined as string | undefined,
  };
}
export const percentile = (values: number[], p: number): number | null =>
  values.length
    ? [...values].sort((a, b) => a - b)[
        Math.max(0, Math.ceil(values.length * p) - 1)
      ]
    : null;
/** Registry proves implementation coverage; rows contain only applicable measured facts. */
export function measuredScore(
  score: ScoreResult,
  registered: readonly string[] = targetRuleIds,
): number | null {
  const targets = rules.data.rules.filter((r) => r.severity === "target"),
    expected = new Set(targets.map((r) => r.id));
  if (
    registered.length !== expected.size ||
    new Set(registered).size !== expected.size ||
    registered.some((id) => !expected.has(id))
  )
    return null;
  const rows = score.perRule;
  if (
    !rows.length ||
    new Set(rows.map((v) => v.id)).size !== rows.length ||
    rows.some(
      (v) =>
        !expected.has(v.id) ||
        !Number.isFinite(v.weight) ||
        v.weight <= 0 ||
        !Number.isFinite(v.satisfaction) ||
        v.satisfaction < 0 ||
        v.satisfaction > 1,
    )
  )
    return null;
  const weighted =
    rows.reduce((sum, v) => sum + v.weight * v.satisfaction, 0) /
    rows.reduce((sum, v) => sum + v.weight, 0);
  return Number.isFinite(score.quality) &&
    score.quality >= 0 &&
    score.quality <= 1 &&
    Math.abs(score.quality - weighted) < 1e-10
    ? score.quality
    : null;
}
export function qualityMetrics(plan: EnginePlan, profile: EngineProfile) {
  const score = scorePlan(plan, profile),
    measuredValue = measuredScore(score),
    measured = measuredValue !== null;
  const eligible = new Set(independentlyPossibleIds(profile)),
    patterns = new Set(
      plan.templates.flatMap((t) =>
        t.items.map((i) => rules.byExercise.get(i.exerciseId)?.primary_pattern),
      ),
    );
  const groups = [
    ["push_horizontal", "push_vertical"],
    ["pull_horizontal", "pull_vertical"],
    ["squat", "hinge", "lunge"],
    [
      "anti_extension",
      "anti_rotation",
      "anti_lateral_flexion",
      "trunk_flexion",
      "rotation",
    ],
  ];
  const required = groups.filter((group) =>
    rules.data.exercises.some(
      (e) => eligible.has(e.id) && group.includes(e.primary_pattern),
    ),
  );
  return {
    score: measuredValue,
    perRule: score.perRule,
    measured,
    coverageApplicable: required.length > 0,
    coverage:
      required.length > 0 &&
      required.every((group) =>
        group.some((pattern) => patterns.has(pattern as never)),
      ),
    within10:
      plan.templates.length > 0 &&
      plan.templates.every(
        (t) =>
          Math.abs(
            estimateMinutes(t, rules) /
              (t.targetMinutes ?? profile.sessionMinutes) -
              1,
          ) <= 0.100000001,
      ),
  };
}
export function environmentStatistics(
  weighted: number,
  extreme: number,
  weightedCount: number,
) {
  const weightedFraction = weightedCount ? weighted / weightedCount : null;
  return {
    weighted,
    extreme,
    weightedFraction,
    weightedLimit: 0.005,
    withinWeightedLimit: weightedFraction !== null && weightedFraction <= 0.005,
  };
}
/** Worker results carry observations only; all numeric accumulation stays in original input order. */
export function observeProfile(profile: EngineProfile, quality: boolean) {
  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
  let result: ReturnType<typeof classify>;
  try {
    result = classify(profile);
  } catch (error) {
    return { error: message(error) };
  }
  let nondeterministic = false,
    repeatError: string | undefined,
    metricsError: string | undefined,
    metrics: ReturnType<typeof qualityMetrics> | undefined;
  try {
    nondeterministic =
      JSON.stringify(generatePlan(profile)) !== JSON.stringify(result.plan);
  } catch (error) {
    repeatError = message(error);
  }
  if (
    repeatError === undefined &&
    quality &&
    !result.blocked &&
    result.status !== "environment_limited" &&
    result.status !== "environment_unavailable"
  )
    try {
      metrics = qualityMetrics(result.plan, profile);
    } catch (error) {
      metricsError = message(error);
    }
  return { result, nondeterministic, metrics, repeatError, metricsError };
}
export type ProfileObservation = ReturnType<typeof observeProfile>;
export interface AuditOptions {
  workers?: number;
  workerUrl?: string;
  snapshots?: string;
  indices?: number[];
  fullStartedAt?: number;
  sourceHash?: string;
}
export async function audit(
  profiles = sampledProfiles(),
  output = ".cache/engine-full.json",
  extremes: EngineProfile[] = [],
  options: AuditOptions = {},
) {
  const start = performance.now(),
    totals: Record<string, number> = {
      pass: 0,
      blocked: 0,
      fail: 0,
      environment_limited: 0,
      environment_unavailable: 0,
    },
    unsafe: { index: number; reason: string; ruleId?: string }[] = [],
    environmentUnmet: {
      index: number;
      ruleId: string;
      patterns: string[];
      issueCodes: string[];
    }[] = [],
    actionableHardViolations: {
      index: number;
      reason: string;
      ruleId?: string;
    }[] = [],
    nondeterministic: number[] = [],
    times: number[] = [],
    generationTimes: number[] = [],
    scores: number[] = [],
    notices: Record<string, number> = {},
    noticeCounts: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 },
    extremeNoticeCounts: Record<string, number> = {
      "0": 0,
      "1": 0,
      "2": 0,
      "3": 0,
    },
    losses = new Map<
      string,
      {
        id: string;
        weightedLoss: number;
        count: number;
        applicableCount: number;
      }
    >(),
    lowScoreLoss = new Map<string, number>();
  const pregnancyRamps: ({ index: number; extreme: boolean } & NonNullable<
    ReturnType<typeof pregnancyRampFacts>
  >)[] = [];
  let intentionalShortEligible = 0,
    nonShortWithin10 = 0;
  const shortageProfiles: ({ index: number } & ReturnType<
    typeof intentionalShortFacts
  >)[] = [];
  let minimumDurationRatio = Infinity,
    below50Count = 0,
    minimumExtremeDurationRatio = Infinity,
    extremeBelow50Count = 0,
    extremeIntentionalShortCount = 0;
  let empty = 0,
    within10 = 0,
    coverage = 0,
    coverageEligible = 0,
    qualityEligible = 0,
    scoreUnmeasured = 0,
    noticeOverflow = 0;
  const coverageMisses: number[] = [],
    lowScoreCases: { index: number; score: number }[] = [];
  const jobs = [
    ...profiles.map((profile) => ({ profile, quality: true })),
    ...extremes.map((profile) => ({ profile, quality: false })),
  ];
  const observations =
    options.workers && options.workers > 1
      ? await parallelProfiles(jobs, options.workers, options.workerUrl)
      : jobs.map((job) => observeProfile(job.profile, job.quality));
  const evaluate = (
    profile: EngineProfile,
    localIndex: number,
    quality: boolean,
  ) => {
    const index = options.indices?.[localIndex] ?? localIndex;
    try {
      const observation = observations[localIndex];
      if (observation.error !== undefined) throw new Error(observation.error);
      const r = observation.result!;
      totals[r.status]++;
      times.push(r.durationMs);
      generationTimes.push(r.generationMs);
      if (
        !r.blocked &&
        r.status !== "environment_limited" &&
        (!r.plan.templates.length ||
          r.plan.templates.some((t) => !t.items.length))
      )
        empty++;
      for (const claim of r.environmentConstraints)
        environmentUnmet.push({ index, ...claim });
      for (const issue of r.issues.filter((i) => i.severity === "error")) {
        const row = { index, reason: issue.code, ruleId: issue.ruleId };
        unsafe.push(row);
        if (
          !r.environmentConstraints.some(
            (c) =>
              c.ruleId === issue.ruleId && c.issueCodes.includes(issue.code),
          )
        )
          actionableHardViolations.push(row);
      }
      const ramp = pregnancyRampFacts(r.plan, profile, rules);
      if (ramp) pregnancyRamps.push({ index, extreme: !quality, ...ramp });
      if (observation.repeatError !== undefined)
        throw new Error(observation.repeatError);
      if (observation.nondeterministic) nondeterministic.push(index);
      if (r.plan.notices.length > 3) noticeOverflow++;
      const distribution = quality ? noticeCounts : extremeNoticeCounts;
      distribution[r.plan.notices.length] =
        (distribution[r.plan.notices.length] ?? 0) + 1;
      for (const n of r.plan.notices)
        notices[n.code] = (notices[n.code] ?? 0) + 1;
      if (!quality && !r.blocked && r.plan.templates.length) {
        const extremeTiming = intentionalShortFacts(r.plan, profile, rules);
        if (extremeTiming.minimumRatio !== null)
          minimumExtremeDurationRatio = Math.min(
            minimumExtremeDurationRatio,
            extremeTiming.minimumRatio,
          );
        if (extremeTiming.below50) extremeBelow50Count++;
        if (extremeTiming.qualified) extremeIntentionalShortCount++;
      }
      if (
        quality &&
        !r.blocked &&
        r.status !== "environment_limited" &&
        r.status !== "environment_unavailable"
      ) {
        qualityEligible++;
        if (observation.metricsError !== undefined)
          throw new Error(observation.metricsError);
        const m = observation.metrics!;
        if (m.score === null) scoreUnmeasured++;
        else scores.push(m.score);
        // Supplemental accounting only: retain the original denominator and gate unchanged.
        const shortage = intentionalShortFacts(r.plan, profile, rules);
        if (shortage.minimumRatio !== null)
          minimumDurationRatio = Math.min(
            minimumDurationRatio,
            shortage.minimumRatio,
          );
        if (shortage.below50) below50Count++;
        if (shortage.qualified) {
          intentionalShortEligible++;
          shortageProfiles.push({ index, ...shortage });
        } else if (m.within10) nonShortWithin10++;
        if (m.within10) within10++;
        if (m.coverageApplicable) {
          coverageEligible++;
          if (m.coverage) coverage++;
          else coverageMisses.push(index);
        }
        if (m.score !== null && m.score < 0.6)
          lowScoreCases.push({ index, score: m.score });
        for (const v of m.perRule) {
          if (
            !rules.byId.get(v.id) ||
            rules.byId.get(v.id)?.severity !== "target"
          )
            continue;
          if (m.score !== null && m.score < 0.6)
            lowScoreLoss.set(
              v.id,
              (lowScoreLoss.get(v.id) ?? 0) + v.weight * (1 - v.satisfaction),
            );
          const row = losses.get(v.id) ?? {
            id: v.id,
            weightedLoss: 0,
            count: 0,
            applicableCount: 0,
          };
          row.applicableCount++;
          row.weightedLoss += v.weight * (1 - v.satisfaction);
          if (v.satisfaction < 1) row.count++;
          losses.set(v.id, row);
        }
      }
    } catch (error) {
      totals.fail++;
      const row = {
        index,
        reason: error instanceof Error ? error.message : String(error),
      };
      unsafe.push(row);
      actionableHardViolations.push(row);
      if (quality) {
        qualityEligible++;
        scoreUnmeasured++;
      }
    }
  };
  profiles.forEach((p, i) => evaluate(p, i, true));
  const weightedTotals = { ...totals };
  extremes.forEach((p, i) => evaluate(p, profiles.length + i, false));
  const report = {
    stage: "V2 diagnostic",
    pregnancyRamp: {
      weightedCount: pregnancyRamps.filter((row) => !row.extreme).length,
      extremeCount: pregnancyRamps.filter((row) => row.extreme).length,
      excludedFromCapacityShortageLimit: true,
      profiles: pregnancyRamps,
    },
    validationCoverage: hardCheckCoverage.complete
      ? "Current source-version hard rules audited; deferred rules and branches listed separately"
      : "Hard coverage audit is missing or stale",
    hardCoverageComplete: hardCheckCoverage.complete,
    seed: TRAINING_ENGINE_SEED,
    evaluated: profiles.length,
    extremeEvaluated: extremes.length,
    weightedTotals,
    extremeTotals: Object.fromEntries(
      Object.keys(totals).map((key) => [
        key,
        totals[key] - weightedTotals[key],
      ]),
    ),
    environmentLimited: environmentStatistics(
      weightedTotals.environment_limited,
      totals.environment_limited - weightedTotals.environment_limited,
      profiles.length,
    ),
    totals,
    empty,
    unsafe,
    environmentUnmet,
    actionableHardViolations,
    nondeterministic,
    qualityEligible,
    coverageEligible,
    coverageEvaluated: coverageEligible,
    scoreUnmeasured,
    coverageMisses,
    lowScoreCases,
    qualityMedian: percentile(scores, 0.5),
    qualityP10: percentile(scores, 0.1),
    within10Rate: qualityEligible ? within10 / qualityEligible : null,
    timingBreakdown: {
      originalEligible: qualityEligible,
      intentionalShort: intentionalShortEligible,
      nonShortEligible: qualityEligible - intentionalShortEligible,
      nonShortWithin10,
      nonShortWithin10Rate:
        qualityEligible > intentionalShortEligible
          ? nonShortWithin10 / (qualityEligible - intentionalShortEligible)
          : null,
      shortageFraction: profiles.length
        ? intentionalShortEligible / profiles.length
        : null,
      shortageFractionLimit: rules.get("duration.cardio.cap").refill
        .shortage_population_fraction_max,
      minimumDurationRatio: Number.isFinite(minimumDurationRatio)
        ? minimumDurationRatio
        : null,
      below50Count,
      minimumExtremeDurationRatio: Number.isFinite(minimumExtremeDurationRatio)
        ? minimumExtremeDurationRatio
        : null,
      extremeBelow50Count,
      extremeIntentionalShortCount,
      shortageProfiles,
      averageGapSeconds: shortageProfiles.length
        ? shortageProfiles
            .flatMap((row) => row.proofs)
            .reduce((sum, row) => sum + row.missingSeconds, 0) /
          shortageProfiles.flatMap((row) => row.proofs).length
        : 0,
      maxGapSeconds: Math.max(
        0,
        ...shortageProfiles
          .flatMap((row) => row.proofs)
          .map((row) => row.missingSeconds),
      ),
    },
    coverageRate: coverageEligible ? coverage / coverageEligible : null,
    notices,
    noticeCounts,
    extremeNoticeCounts,
    noticeOverflow,
    lowScoreLoss: [...lowScoreLoss]
      .map(([id, weightedLoss]) => ({ id, weightedLoss }))
      .sort((a, b) => b.weightedLoss - a.weightedLoss),
    topLoss: [...losses.values()]
      .map((row) => ({
        ...row,
        averageWeightedLoss: row.weightedLoss / row.applicableCount,
      }))
      .sort((a, b) => b.averageWeightedLoss - a.averageWeightedLoss)
      .slice(0, 10),
    performance: {
      totalMs: performance.now() - start,
      p95Ms: percentile(generationTimes, 0.95),
      generationP95Ms: percentile(generationTimes, 0.95),
      classificationP95Ms: percentile(times, 0.95),
    },
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  if (options.snapshots) {
    await mkdir(dirname(options.snapshots), { recursive: true });
    await writeFile(
      options.snapshots,
      JSON.stringify(
        jobs.map((job, index) => ({
          index: options.indices?.[index] ?? index,
          ...job,
          observation: observations[index],
        })),
        (key, value) =>
          key === "durationMs" || key === "generationMs" ? undefined : value,
      ),
    );
  }
  return report;
}
/** Correctness audit only: elapsed time is retained for reporting, never admission. */
export async function fullAudit(options: AuditOptions = {}) {
  const started = options.fullStartedAt ?? Date.now(),
    before = options.sourceHash ?? (await sourceFingerprint());
  if ((await sourceFingerprint()) !== before)
    throw Error("Sources changed during acceptance build");
  const profiles = sampledProfiles(),
    extremes = extremeProfiles();
  const audited = await audit(
    profiles,
    ".cache/engine-full.json",
    extremes,
    options,
  );
  if ((await sourceFingerprint()) !== before)
    throw Error("Sources changed during acceptance run");
  const wallMs = Date.now() - started;
  const report = {
    ...audited,
    performance: {
      ...audited.performance,
      totalMs: wallMs,
      parallelAuditWallMs: audited.performance.totalMs,
      workerContentionP95Ms: audited.performance.p95Ms,
    },
  };
  const evidence = {
    version: EVIDENCE_VERSION,
    sourceHash: before,
    inputHash: digest({ profiles, extremes }),
    seed: TRAINING_ENGINE_SEED,
    nodeVersion: process.version,
    runtimeFingerprint: runtimeFingerprint(),
    wallMs,
    report,
  };
  await writeFile(".cache/engine-full.json", JSON.stringify(report, null, 2));
  await writeFile(
    ".cache/engine-full-evidence.json",
    JSON.stringify(evidence, null, 2),
  );
  const body =
    "# Training engine V2 acceptance report\n\nFunctional correctness evidence. Timing is informational only; engine:perf reports three independent cold 80-profile runs separately.\n\n" +
    "```json\n" +
    JSON.stringify(evidence, null, 2) +
    "\n```\n";
  await mkdir("docs/training-engine", { recursive: true });
  await writeFile("docs/training-engine/acceptance-report.md", body);
  return report;
}
