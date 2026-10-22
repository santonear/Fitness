import { Children, isValidElement, type ReactNode, type ReactElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  createPregnancySafety,
  assertPregnancyItems,
  pregnancyStopKeys,
  pregnancySupineKeys,
  createPregnancyReconfirmationDraft,
  updatePregnancyReconfirmationDraft,
  pregnancyPopulationFromDraft,
  pregnancyAbsoluteKeys,
  pregnancyRelativeKeys,
} from '../../src/application/pregnancy-safety';
import { PregnancySafetyPanel, pregnancySafetyOptions } from '../../src/ui/pages/training/PregnancySafetyPanel';
import { Rules } from '../../src/engine/data';
import { runGates } from '../../src/engine/gates';
import { isHardEligible } from '../../src/engine/candidates';
import { prescribe } from '../../src/engine/dose';
import { engineCopy } from '../../src/coach/engine-copy';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { v8StateSchema, v8WorkoutSchema } from '../../src/domain/schemas';
import type { Repository } from '../../src/persistence/repository';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
type TestElement = ReactElement<{
  children?: ReactNode;
  onClick?: () => unknown;
  role?: string;
}>;
function descendants(node: ReactNode): TestElement[] {
  return Children.toArray(node).flatMap(child =>
    isValidElement<TestElement['props']>(child) ? [child, ...descendants(child.props.children)] : [],
  );
}
function buttonFor(tree: ReactNode, label: string) {
  const matches = descendants(tree).filter(
    node => node.props.children === label && typeof node.props.onClick === 'function',
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}
const at = '2026-10-17T02:00:00.000Z',
  id = 'a1111111-1111-4111-8111-111111111111',
  r = new Rules();
function fixture(consent = true) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
  const p = baseProfile({
      birthYearMonth: '1996-01',
      population: {
        kind: 'pregnant',
        week: 8,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 8,
      },
      constraints: { noJump: false, quiet: false, space: 'large' },
    }),
    g = runGates(p, r);
  const supine = r.data.exercises.find(
    e => e.metricType === 'reps' && e.position.includes('supine') && isHardEligible(e, p, g, { rules: r }),
  )!;
  if (!supine) throw Error('Missing legal early-pregnancy supine positive control');
  const upright = r.data.exercises.find(e => e.slug === 'walking')!,
    item = prescribe(supine, p, r, g.restrictions);
  let state = v8StateSchema.parse({
    id: 'v8',
    migratedAt: at,
    legacyPlanIds: [],
    notice: { planCount: 0, acknowledged: true },
    trainingPause: { requiredAt: at },
    postpartumSafety: { urgentAt: at },
    coachProfile: {
      goalText: '活动',
      goal: 'health',
      population: p.population,
      birthYearMonth: p.birthYearMonth,
      weeklyTarget: 3,
      sessionMinutes: 30,
      scheduleOriginalText: '',
      place: 'home',
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
      confirmedAt: at,
      ...(consent ? { healthStorageConsent: { acceptedAt: at }, screening: p.screening } : {}),
    },
  });
  let rows: WorkoutRecord[] = [
      {
        id,
        startedAt: at,
        localDate: '2026-10-17',
        timeZone: 'Asia/Shanghai',
        status: 'in_progress',
        plannedSetCount: item.sets,
        templateSnapshot: {
          id: 'early',
          name: 'early',
          estimatedMinutes: 30,
          items: [item],
        },
        plannedExercises: [{ exerciseId: supine.id, itemIndex: 0, plannedSetCount: item.sets }],
        sets: [
          {
            exerciseId: supine.id,
            itemIndex: 0,
            setIndex: 0,
            reps: 'reps' in item.target ? item.target.reps : 8,
            completedAt: at,
          },
        ],
      },
    ],
    revision = 0,
    fail = false;
  const repo = {
    write: async <T>(fn: () => Promise<T>, expected?: number) => {
      if (expected !== undefined && expected !== revision) throw Error('CONFLICT');
      const before = structuredClone({ state, rows, revision });
      try {
        const result = await fn();
        revision++;
        return result;
      } catch (error) {
        ({ state, rows, revision } = before);
        throw error;
      }
    },
    db: {
      profiles: {
        toCollection: () => ({
          first: async () => ({ timeZone: 'Asia/Shanghai' }),
        }),
      },
      v8State: {
        get: async () => structuredClone(state),
        put: async (value: typeof state) => {
          if (fail) throw Error('WRITE_FAILED');
          state = v8StateSchema.parse(value);
        },
      },
      v8Workouts: {
        get: async (key: string) => structuredClone(rows.find(row => row.id === key)),
        toArray: async () => structuredClone(rows),
        put: async (value: WorkoutRecord) => {
          rows = rows.map(row => (row.id === value.id ? structuredClone(value) : row));
        },
      },
    },
  } as unknown as Repository;
  return {
    service: createPregnancySafety(repo),
    p,
    supine,
    upright,
    get state() {
      return state;
    },
    get rows() {
      return rows;
    },
    get revision() {
      return revision;
    },
    fresh: () => {
      state.coachProfile!.screening = {
        ...p.screening,
        completedAt: '2026-10-17T02:01:00.000Z',
        rescreenRequired: false,
      };
      vi.setSystemTime(new Date('2026-10-17T02:02:00.000Z'));
    },
    fail: () => {
      fail = true;
    },
  };
}
afterEach(() => vi.useRealTimers());
it('stops immediately for dizziness or feeling faint without waiting for rest', async () => {
  const f = fixture();
  expect(pregnancyStopKeys).toContain('dizziness_or_feeling_faint');
  expect(pregnancyStopKeys).not.toContain('dizziness_or_faintness_not_resolving_with_rest');
  expect(pregnancySafetyOptions('zh', 'stop').find(row => row.key === 'dizziness_or_feeling_faint')?.label).toBe(
    '头晕或要晕倒',
  );
  expect(pregnancySafetyOptions('en', 'stop').find(row => row.key === 'dizziness_or_feeling_faint')?.label).toBe(
    'dizziness or feeling faint',
  );
  await f.service.reportStop(id, ['dizziness_or_feeling_faint'], 0);
  expect(f.rows[0].status).toBe('partial');
  expect(f.state.pregnancySafety?.providerPause).toEqual({ requiredAt: at });
});
it.each(pregnancyStopKeys)(
  'source stop %s atomically ends the session and independently pauses until provider contact',
  async key => {
    const f = fixture(),
      facts = structuredClone(f.rows[0].sets);
    const out = await f.service.reportStop(id, [key], 0);
    expect(f.rows[0]).toMatchObject({
      status: 'partial',
      endedAt: at,
      sets: facts,
    });
    expect(f.state.pregnancySafety?.providerPause).toEqual({ requiredAt: at });
    expect(f.state.coachProfile!.screening!.rescreenRequired).toBe(true);
    expect(out.chestEmergency).toBe(key === 'chest_pain');
    expect(f.state.cardiacPause).toEqual(key === 'chest_pain' ? { requiredAt: at } : undefined);
  },
);
it('without health consent stores only minimal safety timestamps, not selected symptom details', async () => {
  const f = fixture(false);
  await f.service.reportStop(id, ['vaginal_bleeding'], 0);
  expect(f.state.pregnancySafety).toEqual({
    providerPause: { requiredAt: at },
  });
  expect(f.state.coachProfile!.screening).toBeUndefined();
  expect(JSON.stringify(f.state)).not.toContain('vaginal_bleeding');
  expect(JSON.stringify(f.rows)).not.toContain('vaginal_bleeding');
});
it('provider contact clears only its own pause, leaving rescreening, cardiac, pain, postpartum and supine facts intact', async () => {
  const f = fixture();
  await f.service.reportSupine(id, 0, 'nausea', 0);
  await f.service.reportStop(id, ['chest_pain'], 1);
  await expect(f.service.confirmProviderContacted(2)).rejects.toThrow('PREGNANCY_NEW_SCREENING_REQUIRED');
  f.fresh();
  await expect(f.service.confirmProviderContacted(2)).rejects.toThrow('PREGNANCY_SCREENING_GATE_BLOCKED');
  const population = f.state.coachProfile!.population;
  if (population?.kind !== 'pregnant') throw Error('Expected pregnant fixture');
  let draft = updatePregnancyReconfirmationDraft(createPregnancyReconfirmationDraft(population, true), {
    type: 'prenatal',
    answer: true,
  });
  draft = updatePregnancyReconfirmationDraft(draft, {
    type: 'provider',
    answer: true,
  });
  for (const key of [...pregnancyAbsoluteKeys, ...pregnancyRelativeKeys])
    draft = updatePregnancyReconfirmationDraft(draft, {
      type: 'contraindication',
      key,
      answer: false,
    });
  f.state.coachProfile!.population = pregnancyPopulationFromDraft(draft);
  await f.service.confirmProviderContacted(2);
  expect(f.state.pregnancySafety).toEqual({ supineAvoidSince: at });
  expect(f.state.cardiacPause).toEqual({ requiredAt: at });
  expect(f.state.trainingPause).toEqual({ requiredAt: at });
  expect(f.state.postpartumSafety).toEqual({ urgentAt: at });
  expect(f.state.coachProfile!.screening!.rescreenRequired).toBe(false);
});
it.each(pregnancySupineKeys)(
  'source supine %s excludes future supine even at week8, preserving completed facts',
  async key => {
    const f = fixture(),
      before = structuredClone(f.rows[0]);
    expect(f.p.population.kind === 'pregnant' && f.p.population.week).toBe(8);
    expect(isHardEligible(f.supine, f.p, runGates(f.p, r), { rules: r })).toBe(true);
    expect(await f.service.reportSupine(id, 0, key, 0)).toEqual({
      copyKey: 'pregnancy.supine_symptom.copy',
    });
    expect(f.rows[0]).toEqual(before);
    expect(f.state.pregnancySafety?.supineAvoidSince).toBe(at);
    expect(() =>
      assertPregnancyItems([{ exerciseId: f.upright.id }], f.state.pregnancySafety, f.state.coachProfile),
    ).toThrow('PREGNANCY_NEW_SCREENING_REQUIRED');
    f.fresh();
    expect(() =>
      assertPregnancyItems([{ exerciseId: f.supine.id }], f.state.pregnancySafety, f.state.coachProfile),
    ).toThrow('PREGNANCY_SUPINE_AVOID_REQUIRED');
    expect(() =>
      assertPregnancyItems([{ exerciseId: f.upright.id }], f.state.pregnancySafety, f.state.coachProfile),
    ).not.toThrow();
    const changed = { ...f.p, pregnancySafety: { avoidSupine: true } };
    expect(isHardEligible(f.supine, changed, runGates(changed, r), { rules: r })).toBe(false);
    const edited = { ...changed, population: { kind: 'general' as const } };
    expect(isHardEligible(f.supine, edited, runGates(edited, r), { rules: r })).toBe(false);
  },
);
it('uses actual manual substitution identity instead of an old supine snapshot', async () => {
  const f = fixture();
  f.rows[0].substitutions = [
    {
      itemIndex: 0,
      fromExerciseId: f.supine.id,
      toExerciseId: f.upright.id,
      reason: 'other',
      createdAt: at,
    },
  ];
  await expect(f.service.reportSupine(id, 0, 'unwell', 0)).rejects.toThrow('PREGNANCY_SUPINE_ITEM_REQUIRED');
  expect(f.state.pregnancySafety).toBeUndefined();
});
it('rolls back ended workout when pause persistence fails, and rejects stale or malformed events', async () => {
  const f = fixture();
  f.fail();
  await expect(f.service.reportStop(id, ['headache'], 0)).rejects.toThrow('WRITE_FAILED');
  expect(f.rows[0].status).toBe('in_progress');
  expect(f.state.pregnancySafety).toBeUndefined();
  await expect(f.service.reportStop(id, [], 0)).rejects.toThrow();
  await expect(f.service.reportStop(id, ['unknown'], 0)).rejects.toThrow();
  await expect(f.service.reportStop(id, ['headache'], 1)).rejects.toThrow('CONFLICT');
  await expect(f.service.reportSupine(id, 0, 'unknown', 0)).rejects.toThrow();
});
it.each(['zh', 'en'] as const)(
  'renders only approved labels and dispatches all source stop and supine options (%s)',
  locale => {
    const stops: string[][] = [],
      supine: string[] = [];
    for (const kind of ['stop', 'supine'] as const) {
      const source = engineCopy(kind === 'stop' ? 'pregnancy.stop.copy.stop' : 'pregnancy.supine_symptom.copy', locale);
      for (const option of pregnancySafetyOptions(locale, kind)) expect(source).toContain(option.label);
    }
    const tree = PregnancySafetyPanel({
      locale,
      currentSupine: true,
      onBirthReported: () => {},
      onStop: keys => stops.push([...keys]),
      onSupine: key => supine.push(key),
    });
    for (const option of pregnancySafetyOptions(locale, 'stop')) buttonFor(tree, option.label).props.onClick!();
    for (const option of pregnancySafetyOptions(locale, 'supine')) buttonFor(tree, option.label).props.onClick!();
    expect(stops).toEqual(pregnancyStopKeys.map(key => [key]));
    expect(supine).toEqual(pregnancySupineKeys);
  },
);

it.each(['zh', 'en'] as const)(
  'shows source chest emergency copy separately and never clears other pauses from the panel (%s)',
  locale => {
    let confirmations = 0;
    const tree = PregnancySafetyPanel({
      locale,
      paused: true,
      chestEmergency: true,
      onStop: () => {
        throw Error('No continue action');
      },
      onSupine: () => {},
      onConfirmProviderContacted: () => {
        confirmations++;
      },
    });
    const alerts = descendants(tree)
      .filter(node => node.props.role === 'alert')
      .map(node => node.props.children);
    expect(alerts).toEqual([
      engineCopy('pregnancy.stop.copy.chest_emergency', locale),
      engineCopy('pregnancy.stop.copy.paused', locale),
    ]);
    const confirm =
      locale === 'zh'
        ? '联系过医生或助产士后回来确认'
        : "Once you've spoken to your doctor or midwife, come back and confirm";
    buttonFor(tree, confirm).props.onClick!();
    expect(confirmations).toBe(1);
  },
);
it.each(['missing_cmr', 'positive_cmr', 'missing_parq', 'old_screen', 'no_consent', 'illness'] as const)(
  'provider contact cannot bypass %s screening',
  async kind => {
    const f = fixture();
    await f.service.reportStop(id, ['headache'], 0);
    f.fresh();
    const s = f.state.coachProfile!.screening!;
    if (kind === 'missing_cmr') delete s.cmrSymptoms;
    else if (kind === 'positive_cmr') s.cmrSymptoms![Object.keys(s.cmrSymptoms!)[0]] = true;
    else if (kind === 'missing_parq') delete s.parqAnswers;
    else if (kind === 'old_screen') s.completedAt = '2026-10-16T02:00:00.000Z';
    else if (kind === 'no_consent') delete f.state.coachProfile!.healthStorageConsent;
    else s.acuteIllness = true;
    await expect(f.service.confirmProviderContacted(1)).rejects.toThrow(
      kind === 'illness' ? 'PREGNANCY_SCREENING_GATE_BLOCKED' : 'PREGNANCY_NEW_SCREENING_REQUIRED',
    );
    expect(f.state.pregnancySafety?.providerPause).toBeDefined();
  },
);
it('supine horizon stays locked after consent withdrawal or stale screening while permanent avoidance survives fresh screening', async () => {
  const f = fixture(false);
  await f.service.reportSupine(id, 0, 'nausea', 0);
  expect(() =>
    assertPregnancyItems([{ exerciseId: f.upright.id }], f.state.pregnancySafety, f.state.coachProfile),
  ).toThrow('PREGNANCY_NEW_SCREENING_REQUIRED');
  f.fresh();
  expect(() =>
    assertPregnancyItems([{ exerciseId: f.upright.id }], f.state.pregnancySafety, f.state.coachProfile),
  ).toThrow('PREGNANCY_NEW_SCREENING_REQUIRED');
  f.state.coachProfile!.healthStorageConsent = { acceptedAt: at };
  expect(() =>
    assertPregnancyItems([{ exerciseId: f.upright.id }], f.state.pregnancySafety, f.state.coachProfile),
  ).not.toThrow();
  expect(() =>
    assertPregnancyItems([{ exerciseId: f.supine.id }], f.state.pregnancySafety, f.state.coachProfile),
  ).toThrow('PREGNANCY_SUPINE_AVOID_REQUIRED');
});
