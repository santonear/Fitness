import { DATA } from '../../src/engine/data';
import { afterEach, expect, it, vi } from 'vitest';
import { createTrainingStop, cardiacSymptomKeys } from '../../src/application/training-stop';
import { CardiacStopPanel, cardiacStopOptions } from '../../src/ui/pages/training/CardiacStopPanel';
import { engineCopy } from '../../src/coach/engine-copy';
import { v8StateSchema } from '../../src/domain/schemas';
import type { Repository } from '../../src/persistence/repository';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
const at = '2026-10-17T02:00:00.000Z',
  id = 'a1111111-1111-4111-8111-111111111111';
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
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
      population: { kind: 'general' },
      birthYearMonth: '1990-01',
      weeklyTarget: 3,
      sessionMinutes: 30,
      scheduleOriginalText: '',
      place: 'home',
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
      confirmedAt: at,
      healthStorageConsent: { acceptedAt: at },
      screening: {
        parqAllNo: true,
        knownCondition: false,
        symptoms: false,
        cmrSymptoms: Object.fromEntries(
          (DATA.rules.find(row => row.id === 'safety.screen.cmr_symptoms')!.value!.symptoms as string[]).map(key => [
            key,
            false,
          ]),
        ),
        completedAt: at,
        parqAnswers: Array(7).fill(false),
      },
    },
  });
  let rows: WorkoutRecord[] = [
      {
        id,
        startedAt: at,
        localDate: '2026-10-17',
        timeZone: 'Asia/Shanghai',
        status: 'in_progress',
        plannedSetCount: 1,
        sets: [{ exerciseId: DATA.exercises[0].id, itemIndex: 0, setIndex: 0, reps: 5, completedAt: at }],
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
      profiles: { toCollection: () => ({ first: async () => ({ timeZone: 'Asia/Shanghai' }) }) },
      v8State: {
        get: async () => structuredClone(state),
        put: async (value: typeof state) => {
          if (fail) throw Error('WRITE_FAILED');
          state = v8StateSchema.parse(value);
        },
      },
      v8Workouts: {
        toArray: async () => structuredClone(rows),
        put: async (value: WorkoutRecord) => {
          rows = rows.map(row => (row.id === value.id ? structuredClone(value) : row));
        },
      },
    },
  } as unknown as Repository;
  return {
    service: createTrainingStop(repo),
    get state() {
      return state;
    },
    get rows() {
      return rows;
    },
    get revision() {
      return revision;
    },
    fail: () => {
      fail = true;
    },
    noConsent: () => {
      delete state.coachProfile!.healthStorageConsent;
      delete state.coachProfile!.screening;
    },
    screen: (completedAt: string) => {
      state.coachProfile!.screening = {
        parqAllNo: true,
        knownCondition: false,
        symptoms: false,
        cmrSymptoms: Object.fromEntries(
          (DATA.rules.find(row => row.id === 'safety.screen.cmr_symptoms')!.value!.symptoms as string[]).map(key => [
            key,
            false,
          ]),
        ),
        completedAt,
        parqAnswers: Array(7).fill(false),
      };
    },
  };
}
afterEach(() => vi.useRealTimers());
it.each(cardiacSymptomKeys)(
  'ends and independently pauses for source symptom %s without changing completed sets',
  async key => {
    const f = fixture(),
      sets = structuredClone(f.rows[0].sets);
    f.noConsent();
    await f.service.report(id, [key], 0);
    expect(f.rows[0]).toMatchObject({ status: 'partial', endedAt: at, sets });
    expect(f.state.cardiacPause).toEqual({ requiredAt: at });
    expect(JSON.stringify(f.state)).not.toContain(key);
    expect(JSON.stringify(f.rows)).not.toContain(key);
    expect(f.state.trainingPause).toEqual({ requiredAt: at });
  },
);
it('rolls back both the ended workout and pause on persistence failure', async () => {
  const f = fixture();
  f.fail();
  await expect(f.service.report(id, [cardiacSymptomKeys[0]], 0)).rejects.toThrow('WRITE_FAILED');
  expect(f.rows[0].status).toBe('in_progress');
  expect(f.state.cardiacPause).toBeUndefined();
  expect(f.revision).toBe(0);
});
it('rejects empty/forged symptoms and stale revision without changing state', async () => {
  const f = fixture();
  for (const keys of [[], ['joint_pain']]) await expect(f.service.report(id, keys, 0)).rejects.toThrow();
  await expect(f.service.report(id, [cardiacSymptomKeys[0]], 1)).rejects.toThrow('CONFLICT');
  expect(f.rows[0].status).toBe('in_progress');
});
it('requires fresh completed screening and clears only the independent cardiac pause', async () => {
  const f = fixture();
  vi.setSystemTime(new Date('2026-10-17T03:00:00Z'));
  await f.service.report(id, [cardiacSymptomKeys[0]], 0);
  await expect(f.service.confirmClearance({ date: '2026-10-17', intensity: 'moderate' }, 1)).rejects.toThrow(
    'CARDIAC_NEW_SCREENING_REQUIRED',
  );
  f.screen('2026-10-17T03:01:00Z');
  vi.setSystemTime(new Date('2026-10-17T03:02:00Z'));
  await f.service.confirmClearance({ date: '2026-10-17', intensity: 'moderate' }, 1);
  expect(f.state.cardiacPause).toBeUndefined();
  expect(f.state.trainingPause).toEqual({ requiredAt: at });
  expect(f.state.postpartumSafety).toEqual({ urgentAt: at });
  expect(f.state.coachProfile!.screening!.clearance).toEqual({ date: '2026-10-17', intensity: 'moderate' });
});
it('does not accept future screening, withdrawn consent, or professional attestation before the pause', async () => {
  const f = fixture();
  await f.service.report(id, [cardiacSymptomKeys[0]], 0);
  f.screen('2026-10-18T02:00:00Z');
  await expect(f.service.confirmClearance({ date: '2026-10-17', intensity: 'vigorous' }, 1)).rejects.toThrow();
  f.screen(at);
  await expect(f.service.confirmClearance({ date: '2026-10-16', intensity: 'vigorous' }, 1)).rejects.toThrow(
    'INVALID_CLEARANCE_DATE',
  );
  f.noConsent();
  await expect(f.service.confirmClearance({ date: '2026-10-17', intensity: 'vigorous' }, 1)).rejects.toThrow();
  expect(f.state.cardiacPause).toBeDefined();
});
it.each(['zh', 'en'] as const)(
  'uses six approved verbatim labels and immediately dispatches every option (%s)',
  locale => {
    const options = cardiacStopOptions(locale),
      calls: string[][] = [];
    expect(options.map(x => x.key)).toEqual(cardiacSymptomKeys);
    for (const option of options) expect(engineCopy('safety.copy.stop_symptoms', locale)).toContain(option.label);
    const tree = CardiacStopPanel({ locale, onStop: keys => calls.push([...keys]) });
    const buttons = tree.props.children[1];
    for (const button of buttons) button.props.onClick();
    expect(calls).toEqual(cardiacSymptomKeys.map(key => [key]));
    const paused = CardiacStopPanel({
      locale,
      paused: true,
      onStop: () => {
        throw Error('must not continue');
      },
    });
    expect(paused.props.children.props.role).toBe('alert');
    expect(paused.props.children.props.children).toBe(engineCopy('safety.copy.stop_emergency', locale));
  },
);

it('requires every source CMR answer, rejecting aggregate-only and current positive symptoms', async () => {
  const f = fixture();
  await f.service.report(id, [cardiacSymptomKeys[0]], 0);
  delete f.state.coachProfile!.screening!.cmrSymptoms;
  await expect(f.service.confirmClearance({ date: '2026-10-17', intensity: 'moderate' }, 1)).rejects.toThrow(
    'CARDIAC_NEW_SCREENING_REQUIRED',
  );
  f.screen(at);
  const key = Object.keys(f.state.coachProfile!.screening!.cmrSymptoms!)[0];
  f.state.coachProfile!.screening!.cmrSymptoms![key] = true;
  await expect(f.service.confirmClearance({ date: '2026-10-17', intensity: 'moderate' }, 1)).rejects.toThrow(
    'CARDIAC_NEW_SCREENING_REQUIRED',
  );
  expect(f.state.cardiacPause).toBeDefined();
});

it.each(['underage', 'illness'] as const)(
  'does not clear a pause when current %s screening gate blocks',
  async kind => {
    const f = fixture();
    await f.service.report(id, [cardiacSymptomKeys[0]], 0);
    if (kind === 'underage') f.state.coachProfile!.birthYearMonth = '2010-01';
    else f.state.coachProfile!.screening!.acuteIllness = true;
    await expect(f.service.confirmClearance({ date: '2026-10-17', intensity: 'moderate' }, 1)).rejects.toThrow(
      'CARDIAC_SCREENING_GATE_BLOCKED',
    );
    expect(f.state.cardiacPause).toBeDefined();
  },
);
it('can pause without an active workout and cannot fabricate completion of an empty workout', async () => {
  const f = fixture();
  f.rows[0].sets = [];
  await f.service.report(id, [cardiacSymptomKeys[0]], 0);
  expect(f.rows[0]).toMatchObject({ status: 'not_started', sets: [], endedAt: at });
  vi.setSystemTime(new Date('2026-10-17T03:00:00Z'));
  await f.service.report(undefined, [cardiacSymptomKeys[1]], 1);
  expect(f.state.cardiacPause).toEqual({ requiredAt: '2026-10-17T03:00:00.000Z' });
  expect(f.rows[0].endedAt).toBe(at);
});
