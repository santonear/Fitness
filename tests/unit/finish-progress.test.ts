import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SetFact, WorkoutRecord } from '../../src/domain/v8/contracts';
import { progressMoments } from '../../src/application/my-changes';
import { checkCoachLanguage } from '../../src/application/rules/coach-language';
import zh from '../../src/i18n/features/training/finish.zh.json';
import en from '../../src/i18n/features/training/finish.en.json';

const set = (exerciseId: string, fact: Partial<SetFact>): SetFact => ({
  exerciseId,
  itemIndex: 0,
  setIndex: 0,
  completedAt: '2026-10-01T10:00:00Z',
  ...fact,
});
const workout = (id: string, sets: SetFact[], status: WorkoutRecord['status'] = 'complete'): WorkoutRecord => ({
  id,
  startedAt: '2026-10-01T10:00:00Z',
  localDate: '2026-10-01',
  timeZone: 'Asia/Shanghai',
  status,
  sets,
  plannedSetCount: sets.length,
});

describe('finish page progress moments', () => {
  const history = [
    workout('a', [
      set('squat', { reps: 10 }),
      set('bench', { loadGrams: 7500, reps: 8 }),
      set('plank', { durationSeconds: 40 }),
    ]),
    workout('b', [set('squat', { reps: 30 })], 'abandoned'),
  ];
  it('compares load for weighted sets, reps for bodyweight and seconds for timed, best first', () => {
    const now = workout('now', [
      set('squat', { reps: 12 }),
      set('bench', { loadGrams: 10000, reps: 6 }),
      set('bench', { loadGrams: 10000, reps: 8 }),
      set('plank', { durationSeconds: 45 }),
    ]);
    expect(progressMoments(history, now, 3)).toEqual([
      { exerciseId: 'bench', metric: 'load', value: 10, reps: 8, gain: 2.5 },
      { exerciseId: 'squat', metric: 'reps', value: 12, gain: 2 },
      { exerciseId: 'plank', metric: 'seconds', value: 45, gain: 5 },
    ]);
    expect(progressMoments(history, now)).toHaveLength(2);
  });
  it('shows nothing without an earlier record, on a tie, or when this one is lower', () => {
    const now = workout('now', [
      set('lunge', { reps: 20 }),
      set('squat', { reps: 10 }),
      set('bench', { loadGrams: 5000, reps: 12 }),
    ]);
    expect(progressMoments(history, now)).toEqual([]);
    // The active workout itself is never its own earlier record.
    expect(progressMoments([...history, now], now)).toEqual([]);
  });
  it('keeps the new copy within the coach language rules', () => {
    for (const copy of [zh, en])
      for (const text of Object.values(copy).filter(value => typeof value === 'string'))
        expect(checkCoachLanguage(text), text).toEqual([]);
  });
});

describe('home-screen hint route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  function browser(userAgent: string, standalone = false) {
    const listeners = new Map<string, (event: Event) => void>();
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: standalone }),
      addEventListener: (type: string, listener: (event: Event) => void) => listeners.set(type, listener),
    });
    vi.stubGlobal('navigator', { userAgent, platform: 'x', maxTouchPoints: 0 });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    return listeners;
  }
  it('offers the captured prompt, then iOS or menu instructions, and nothing once installed', async () => {
    const listeners = browser('Chrome');
    const pwa = await import('../../src/application/pwa');
    expect(pwa.installRoute()).toBe('menu');
    const prompt = vi.fn().mockResolvedValue(undefined);
    listeners.get('beforeinstallprompt')!(Object.assign(new Event('x'), { prompt }));
    expect(pwa.installRoute()).toBe('prompt');
    expect(await pwa.promptInstall()).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    expect(pwa.installRoute()).toBe('menu');
    expect(pwa.installHintDue()).toBe(true);
    pwa.markInstallHintShown();
    expect(pwa.installHintDue()).toBe(false);
  });
  it('detects iOS Safari and an installed app', async () => {
    browser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect((await import('../../src/application/pwa')).installRoute()).toBe('ios');
    vi.resetModules();
    browser('Chrome', true);
    expect((await import('../../src/application/pwa')).installRoute()).toBe('installed');
  });
});
