import { describe, expect, it } from 'vitest';
import {
  adjustToday,
  generatePlan,
  getEligibleExercises,
  modifyPlan,
  nextTargets,
  substitute,
  validatePlan,
} from '../../src/engine';
import { engineReplacementIds } from '../../src/application/engine-replacement-candidates';
import { checkHard } from '../../src/engine/hard-checks';
import { runGates } from '../../src/engine/gates';
import { Rules } from '../../src/engine/data';
import { isYogaSession } from '../../src/engine/yoga-session';
import { baseProfile, sampledProfiles } from '../../tools/eval/training-engine-profiles';
import { externalIssues } from '../../tools/eval/training-engine-invariants';
import yoga from '../../data/training-engine/yoga-poses.json';
import { toEngineProfile, type EngineCoachProfile } from '../../src/application/engine-profile';
import { planReasons, sessionKind, sessionNames } from '../../src/application/plan-presentation';
import { muscleTip } from '../../src/application/yaya-tips';
import type { PlanVersion } from '../../src/domain/v8/contracts';
import onboardingZh from '../../src/i18n/features/onboarding/zh.json';
import onboardingEn from '../../src/i18n/features/onboarding/en.json';
import { goalFromText } from '../../src/application/engine-profile';
import { basicProposal } from '../../src/application/workflow/plan-setup';
import { exercises } from '../../src/catalog/exercises';
import { engineMetricMatches } from '../../src/coach/engine-template-validation';
import { getExerciseTags } from '../../src/catalog/exercise-tags';

const r = new Rules();
const slotOrder: string[] = r.get('week.day.yoga').slots.map((slot: { family: string }) => slot.family);
const family = (id: string) => r.byExercise.get(id)?.yoga_family ?? '';

describe('yoga goal', () => {
  it('schedules yoga sessions on every non-strength day, strength days by weekly days', () => {
    for (const [days, strength] of [
      [1, 0],
      [2, 0],
      [3, 1],
      [4, 1],
      [5, 2],
      [6, 2],
    ] as const) {
      const plan = generatePlan(baseProfile({ goal: 'yoga', daysPerWeek: days, sessionMinutes: 30 }));
      expect(plan.templates).toHaveLength(days);
      expect(plan.templates.filter(t => !isYogaSession(t))).toHaveLength(strength);
    }
  });

  it('follows the fixed pose sequence and ends with a resting pose', () => {
    for (const minutes of [10, 20, 30, 45, 60, 90])
      for (const level of ['beginner', 'intermediate'] as const) {
        const plan = generatePlan(baseProfile({ goal: 'yoga', daysPerWeek: 2, sessionMinutes: minutes, level }));
        for (const t of plan.templates.filter(isYogaSession)) {
          const order = t.items.map(i => slotOrder.indexOf(family(i.exerciseId)));
          expect(order, `${minutes} ${level}`).toEqual([...order].sort((a, b) => a - b));
          expect(family(t.items.at(-1)!.exerciseId)).toBe('rest');
          expect(new Set(t.items.map(i => i.exerciseId)).size).toBe(t.items.length);
          expect(t.name).toBe('瑜伽');
        }
      }
  });

  it('keeps yoga-only poses out of every other goal', () => {
    const only = new Set(yoga.yogaOnly);
    for (const goal of ['health', 'mobility', 'muscle'] as const) {
      const plan = generatePlan(baseProfile({ goal, daysPerWeek: 5, sessionMinutes: 45 }));
      const slugs = plan.templates.flatMap(t => t.items.map(i => r.byExercise.get(i.exerciseId)!.slug));
      expect(slugs.filter(slug => only.has(slug))).toEqual([]);
    }
  });

  it('never breaks a hard rule or an independent safety check across sampled users', { timeout: 120_000 }, () => {
    for (const source of sampledProfiles(150)) {
      const profile = { ...source, goal: 'yoga' as const },
        plan = generatePlan(profile),
        gate = runGates(profile, r);
      expect(checkHard(plan, profile, gate, r).filter(issue => issue.severity === 'error')).toEqual([]);
      expect(externalIssues(plan, profile).filter(issue => issue.severity === 'error')).toEqual([]);
    }
  });

  it('gives pregnant users no supine or inverted poses and older users a balance pose', () => {
    const pregnant = generatePlan(
      baseProfile({
        goal: 'yoga',
        daysPerWeek: 3,
        sessionMinutes: 45,
        population: {
          kind: 'pregnant',
          week: 24,
          providerCleared: true,
          prenatalCareConfirmed: true,
          contraindicationsConfirmedNone: true,
          lastScreenedWeek: 24,
        },
      }),
    );
    const positions = pregnant.templates
      .filter(isYogaSession)
      .flatMap(t => t.items.flatMap(i => r.byExercise.get(i.exerciseId)!.position));
    expect(positions.length).toBeGreaterThan(0);
    expect(positions).not.toContain('inverted');
    const older = generatePlan(
      baseProfile({
        goal: 'yoga',
        daysPerWeek: 2,
        sessionMinutes: 10,
        birthYearMonth: '1956-06',
        population: { kind: 'older_adult', fallsAnswers: [false, false, false, false] },
      }),
    );
    for (const t of older.templates.filter(isYogaSession))
      expect(t.items.some(i => r.byExercise.get(i.exerciseId)!.primary_pattern === 'balance')).toBe(true);
  });
  it('reads the yoga onboarding answer as the yoga goal and names its sessions 瑜伽', () => {
    const p = baseProfile({ goal: 'yoga', daysPerWeek: 2 }),
      coach = (goalText: string): EngineCoachProfile => ({
        goalText,
        weeklyTarget: 2,
        sessionMinutes: 30,
        scheduleOriginalText: '每周两次',
        place: 'home',
        equipment: ['none'],
        adultConfirmed: true,
        cautions: [],
        confirmedAt: '2026-10-16T00:00:00.000Z',
        population: p.population,
        screening: p.screening,
        healthStorageConsent: { acceptedAt: '2026-10-16T00:00:00.000Z' },
        constraints: { noJump: false, quiet: false, space: 'mat' },
      });
    for (const answer of [onboardingZh.answers[0][3], onboardingEn.answers[0][3]])
      expect(toEngineProfile(coach(answer), { asOfDate: '2026-10-16', ageYears: 30 })?.goal).toBe('yoga');
    expect(toEngineProfile(coach(onboardingZh.answers[0][2]), { asOfDate: '2026-10-16', ageYears: 30 })?.goal).toBe(
      'health',
    );
    const templates = generatePlan(p).templates;
    expect(templates.map(t => sessionKind(t))).toEqual(['yoga', 'yoga']);
    expect([...sessionNames(templates, 'en').values()]).toEqual(['Yoga', 'Yoga']);
    expect(generatePlan(p).notices.map(n => n.ruleId)).not.toContain('engine.copy.target_volume');
    expect(toEngineProfile(coach('减脂，偶尔做瑜伽'), { asOfDate: '2026-10-16', ageYears: 30 })?.goal).toBe('fat_loss');
  });

  it('keeps swaps, today adjustments and the eligible lists inside the yoga sequence', () => {
    const p = baseProfile({ goal: 'yoga', daysPerWeek: 3, sessionMinutes: 45 }),
      plan = generatePlan(p),
      session = plan.templates.find(isYogaSession)!;
    expect(family(session.items.at(-1)!.exerciseId)).toBe('rest');
    const rest = session.items.at(-1)!.target;
    expect('durationSeconds' in rest && rest.durationSeconds).toBeLessThanOrEqual(300);
    for (const item of session.items.slice(0, -1)) {
      const swapped = substitute(item, p, 'dislike').value;
      expect(swapped.exerciseId).not.toBe(item.exerciseId);
      expect(swapped.prescription?.sourcePosition).toBe(item.prescription?.sourcePosition);
      if (item.prescription?.sourcePosition?.startsWith('yoga_balance'))
        expect(r.byExercise.get(swapped.exerciseId)?.primary_pattern).toBe('balance');
      else expect(family(swapped.exerciseId)).toBe(family(item.exerciseId));
    }
    const shorter = adjustToday(session, p, { minutes: 20 }).value;
    expect(isYogaSession(shorter)).toBe(true);
    expect(shorter.name).toBe(session.name);
    expect(shorter.items.length).toBeLessThan(session.items.length);
    expect(shorter.items.every(i => session.items.some(s => s.exerciseId === i.exerciseId))).toBe(true);
    const ids = session.items.map(i => i.exerciseId),
      eligible = new Set(getEligibleExercises(p).map(e => e.exerciseId)),
      swaps = new Set(engineReplacementIds(p, r));
    expect(ids.filter(id => !eligible.has(id) || !swaps.has(id))).toEqual([]);
    const other = new Set(getEligibleExercises(baseProfile({ goal: 'health' })).map(e => e.exerciseId));
    expect(yoga.yogaOnly.filter(slug => [...other].some(id => r.byExercise.get(id)?.slug === slug))).toEqual([]);
  });

  it('keeps sore areas, plan edits, next-week targets and tips inside the yoga sequence', () => {
    const p = baseProfile({ goal: 'yoga', daysPerWeek: 3, sessionMinutes: 30, cautionLevels: { knee: 1, wrist: 1 } }),
      plan = generatePlan(p),
      session = plan.templates.find(isYogaSession)!;
    for (const joint of ['knee', 'wrist'] as const) {
      const sore = adjustToday(session, p, { painArea: joint }).value;
      expect(isYogaSession(sore)).toBe(true);
      expect(sore.items.filter(i => (r.byExercise.get(i.exerciseId)!.joint_load[joint] ?? 0) >= 2)).toEqual([]);
    }
    const strength = r.data.exercises.find(e => e.primary_pattern === 'squat' && !e.yoga_family)!.id,
      pose = r.data.yogaExercises!.find(e => !session.items.some(i => i.exerciseId === e.id) && e.yoga_family)!,
      added = modifyPlan(plan, p, [{ op: 'add', templateId: session.id, exerciseId: strength }]).value;
    expect(added.templates.find(t => t.id === session.id)!.items.map(i => i.exerciseId)).not.toContain(strength);
    const index = session.items.findIndex(i => family(i.exerciseId) === pose.yoga_family),
      replaced = modifyPlan(plan, p, [
        { op: 'replace', templateId: session.id, itemIndex: index, replacementId: pose.id },
      ]).value.templates.find(t => t.id === session.id)!;
    if (index >= 0) expect(replaced.items[index].exerciseId).toBe(pose.id);
    expect(isYogaSession(replaced)).toBe(true);

    let next = plan;
    for (const day of ['2026-10-13', '2026-10-15', '2026-10-17', '2026-10-19', '2026-10-21']) {
      const t = next.templates[0];
      next = nextTargets(
        [
          {
            id: day,
            templateId: t.id,
            localDate: day,
            timeZone: 'UTC',
            status: 'complete',
            startedAt: `${day}T08:00:00Z`,
            endedAt: `${day}T08:30:00Z`,
            plannedSetCount: t.items.reduce((n, i) => n + i.sets, 0),
            sets: t.items.flatMap((i, itemIndex) =>
              Array.from({ length: i.sets }, (_, setIndex) => ({
                exerciseId: i.exerciseId,
                itemIndex,
                setIndex,
                ...i.target,
                completedAt: `${day}T08:20:00Z`,
              })),
            ),
          } as never,
        ],
        next,
        { ...p, asOfDate: day },
      ).value;
    }
    expect(validatePlan(next, p).filter(i => i.severity === 'error')).toEqual([]);
    for (const item of next.templates.filter(isYogaSession).flatMap(t => t.items)) {
      const max = r.byExercise.get(item.exerciseId)!.default_dose[p.level]?.seconds?.[1];
      if (max && 'durationSeconds' in item.target) expect(item.target.durationSeconds).toBeLessThanOrEqual(max);
    }

    const version = { templates: plan.templates } as unknown as PlanVersion;
    expect(muscleTip({ version, templateId: session.id, weekLoads: [], weekSets: [] })).toBeUndefined();
    expect(planReasons({ ...version, weeklyTarget: 2, preferredDays: [] }, 'zh').join('')).not.toContain('肌肉');
  });

  it('keeps every position a yoga pose for a healthy user and closes the floor part with seated folds', () => {
    for (const level of ['beginner', 'intermediate'] as const)
      for (const minutes of [30, 45, 60, 90]) {
        const p = baseProfile({ goal: 'yoga', daysPerWeek: 2, sessionMinutes: minutes, level }),
          plan = generatePlan(p);
        for (const t of plan.templates.filter(isYogaSession)) {
          expect(t.items.filter(i => !family(i.exerciseId)).map(i => r.byExercise.get(i.exerciseId)?.slug)).toEqual([]);
          const folds = t.items.filter(i => family(i.exerciseId) === 'forward_fold');
          for (const fold of folds)
            expect(
              r.byExercise.get(fold.exerciseId)?.position.some(x => x !== 'standing'),
              fold.exerciseId,
            ).toBe(true);
        }
        expect(plan.notices.map(n => n.ruleId)).not.toContain('engine.copy.target_aerobic');
      }
  });

  it('reads the goal text with yoga last and gives a basic yoga session when the engine is off', () => {
    expect(goalFromText('想练瑜伽，身心都舒展')).toBe('yoga');
    expect(goalFromText('增肌，也想练瑜伽')).toBe('muscle');
    const proposal = basicProposal({
      goalText: '想练瑜伽，身心都舒展',
      weeklyTarget: 3,
      preferredDays: [],
      sessionMinutes: 30,
      scheduleOriginalText: '每周三次',
      place: 'home',
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
      confirmedAt: '2026-10-16T00:00:00.000Z',
    } as never)!;
    for (const t of proposal.templates) {
      expect(isYogaSession(t)).toBe(true);
      expect(sessionKind(t)).toBe('yoga');
      expect(r.byExercise.get(t.items.at(-1)!.exerciseId)?.slug).toBe('savasana');
    }
    expect(proposal.reasons.join('')).not.toContain('力量');
    expect(exercises.filter(e => e.name.zh === '徒手深蹲')).toHaveLength(1);
  });

  it('closes with a calm pose when the resting pose is not allowed', () => {
    const plan = generatePlan(
      baseProfile({
        goal: 'yoga',
        daysPerWeek: 2,
        sessionMinutes: 30,
        pregnancySafety: { avoidSupine: true },
        population: {
          kind: 'pregnant',
          week: 24,
          providerCleared: true,
          prenatalCareConfirmed: true,
          contraindicationsConfirmedNone: true,
          lastScreenedWeek: 24,
        },
      }),
    );
    for (const t of plan.templates.filter(isYogaSession)) {
      const last = r.byExercise.get(t.items.at(-1)!.exerciseId)!;
      expect(t.items.at(-1)!.prescription?.sourcePosition).toBe('yoga_rest');
      expect(last.position).not.toContain('supine');
      expect(['rest', 'centering']).toContain(last.yoga_family);
    }
  });

  it('plans reps-counted flows in reps and passes the plan-edit metric check', () => {
    for (const level of ['beginner', 'intermediate'] as const)
      for (const days of [2, 3, 6]) {
        const p = baseProfile({ goal: 'yoga', daysPerWeek: days, sessionMinutes: 45, level });
        for (const t of generatePlan(p).templates)
          for (const item of t.items) {
            const e = r.byExercise.get(item.exerciseId)!;
            if (e.yoga_family)
              expect(item.target.metricType, e.slug).toBe(e.metricType === 'reps' ? 'reps' : 'duration');
            expect(engineMetricMatches({ engineProfile: p } as never, item as never), e.slug).toBe(true);
          }
      }
    // Plans saved before this fix hold the same flows in seconds; edits to them still pass.
    const p = baseProfile({ goal: 'yoga' }),
      flow = [...r.byExercise.values()].find(e => e.slug === 'downward-dog-to-plank')!;
    expect(
      engineMetricMatches(
        { engineProfile: p } as never,
        {
          exerciseId: flow.id,
          sets: 2,
          target: { metricType: 'duration', durationSeconds: 60 },
          prescription: { pattern: flow.primary_pattern, block: 'warmup', rir: [0, 0], restSeconds: 15 },
        } as never,
      ),
    ).toBe(true);
    expect(getExerciseTags(flow.id).goals).toContain('yoga');
  });
});
