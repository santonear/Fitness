import { describe, it, expect } from 'vitest';
import type { EngineProfile, Plan } from '../../../src/engine/contracts';
import { Rules } from '../../../src/engine/data';
import { targetSatisfactions } from '../../../src/engine/score';
import { fixtureProfile, planFixture } from './fixtures';
type Context = Parameters<(typeof targetSatisfactions)[string]>[0];
const r = new Rules(),
  base = planFixture(),
  item = base.templates[0].items[0],
  muscles = r.get('dose.muscle_groups').target_groups as string[];
function context(id: string): Context {
  return {
    plan: structuredClone(base),
    p: structuredClone(fixtureProfile),
    r,
    v: r.get(id),
    f: {
      sessions: [],
      items: [],
      rt: [],
      sets: {},
      patterns: new Set(),
      aerobic: 0,
      hardAerobic: 0,
      seconds: 0,
      resistance: 0,
      mobility: 0,
      balanceDays: 0,
    },
  };
}
function session(block = 'conditioning', seconds = 1800) {
  const t = structuredClone(base.templates[0]);
  t.items[0].prescription!.block = block as typeof item.prescription extends undefined
    ? never
    : NonNullable<typeof item.prescription>['block'];
  t.items[0].target = { metricType: 'duration', durationSeconds: seconds };
  return t;
}
function expose(c: Context, days: number, sets = 2) {
  const exercises = muscles.map(g =>
    r.data.exercises.find(
      e =>
        e.modality === 'strength' &&
        (e.primaryMuscles ?? []).some(m => r.get('dose.muscle_groups').catalog_map[m] === g),
    )!,
  );
  const templates = Array.from({ length: days }, (_, i) => {
    const t = session('main');
    t.id = `session-${i}`;
    t.items = exercises.map(exercise => ({
      ...structuredClone(t.items[0]),
      exerciseId: exercise.id,
      sets,
      target: { metricType: 'reps' as const, reps: 12 },
      prescription: {
        ...t.items[0].prescription!,
        rir: [2, 2] as [number, number],
      },
    }));
    return t;
  });
  c.f.rt = templates;
  c.f.sessions = templates;
  c.f.items = templates.flatMap(t => t.items);
  return c;
}
function allSets(c: Context, sets: number) {
  c.f.sets = Object.fromEntries(muscles.map(g => [g, sets]));
  return c;
}
interface Matrix {
  id: string;
  make: (level: 0 | 1 | 2) => Context;
  binary?: boolean;
  unmeasured?: boolean;
}
const aerobic = ['goal.aerobic.baseline', 'aerobic.target.weekly', 'older.week.aerobic'].map(id => ({
  id,
  make: (level: 0 | 1 | 2) => {
    const c = context(id);
    if (id.startsWith('older')) c.p.population = { kind: 'older_adult' };
    c.f.aerobic = level * 75;
    return c;
  },
}));
const matrices: Matrix[] = [
  ...aerobic,
  {
    id: 'safety.session.warmup_cooldown',
    make: level => {
      const c = context('safety.session.warmup_cooldown'),
        t = session();
      t.items[0].prescription!.targetRpe = [5, 5];
      if (level > 0)
        for (const block of ['warmup', 'cooldown']) {
          const part = session(block, level * 150);
          t.items.push(part.items[0]);
        }
      c.f.sessions = [t];
      return c;
    },
  },
  {
    id: 'goal.floor.all',
    make: level => {
      const c = context('goal.floor.all');
      return expose(c, level);
    },
  },
  {
    id: 'goal.interference.guard',
    make: level => {
      const c = context('goal.interference.guard');
      c.f.hardAerobic = level === 2 ? 90 : level === 1 ? 135 : 180;
      c.f.sessions = Array.from({ length: level === 2 ? 3 : level === 1 ? 4 : 6 }, () => {
        const t = session();
        t.items[0].prescription!.targetRpe = [7, 7];
        return t;
      });
      return c;
    },
  },
  {
    id: 'week.coverage.patterns',
    make: level => {
      const c = context('week.coverage.patterns');
      const patterns =
        level === 2
          ? [
              'squat',
              'lunge',
              'hinge',
              'push_horizontal',
              'push_vertical',
              'pull_horizontal',
              'pull_vertical',
              'anti_extension',
            ]
          : level === 1
            ? ['squat', 'hinge']
            : [];
      c.f.patterns = new Set(patterns);
      c.f.rt = Array.from({ length: 2 }, () => {
        const t = session('main');
        t.items = (patterns.length ? patterns : ['isolation_upper']).map(pattern => ({
          ...structuredClone(t.items[0]),
          exerciseId: r.data.exercises.find(e => e.primary_pattern === pattern)!.id,
        }));
        return t;
      });
      return c;
    },
  },
  {
    id: 'week.frequency.per_muscle',
    make: level => {
      const c = context('week.frequency.per_muscle');
      expose(c, level);
      return c;
    },
  },
  {
    id: 'week.recovery.spacing',
    make: level => {
      const c = context('week.recovery.spacing');
      expose(c, 2);
      c.plan.preferredDays = level === 2 ? ['mon', 'thu'] : level === 1 ? ['mon', 'tue'] : ['mon', 'mon'];
      c.f.sessions = c.f.rt;
      return c;
    },
  },
  {
    id: 'session.warmup.general',
    make: level => {
      const c = context('session.warmup.general');
      c.f.sessions = [session('warmup', level * 30)];
      return c;
    },
  },
  {
    id: 'session.warmup.dynamic',
    make: level => {
      const c = context('session.warmup.dynamic'),
        e = r.data.exercises.find(e => e.mobility_type === 'dynamic')!,
        good = session('warmup', 30),
        bad = session('conditioning');
      good.items[0].exerciseId = e.id;
      const strength = r.data.exercises.find(x => x.modality === 'strength' && x.bodyPart === e.bodyPart)!;
      const main = session('main').items[0];
      main.exerciseId = strength.id;
      good.items.push(main);
      bad.items.push(structuredClone(main));
      c.f.rt = level === 2 ? [good] : level === 1 ? [good, bad] : [bad];
      return c;
    },
  },
  {
    id: 'session.warmup.balance_older',
    make: level => {
      const c = context('session.warmup.balance_older'),
        e = r.data.exercises.find(e => e.primary_pattern === 'balance' && !e.time.per_side)!,
        t = session('warmup', level * 30);
      t.items[0].exerciseId = e.id;
      c.p.population = { kind: 'older_adult' };
      c.f.sessions = [t];
      return c;
    },
  },
  {
    id: 'session.warmup.no_long_static',
    make: level => {
      const c = context('session.warmup.no_long_static'),
        e = r.data.exercises.find(
          e => e.mobility_type === 'static' && e.use.includes('warmup') && !!e.stretch_targets?.length,
        )!,
        good = session('warmup', 30).items[0],
        bad = session('warmup', 90).items[0];
      good.exerciseId = e.id;
      bad.exerciseId = e.id;
      const dynamic = session('warmup', 30).items[0];
      dynamic.exerciseId = r.data.exercises.find(e => e.mobility_type === 'dynamic')!.id;
      c.f.items = level === 2 ? [good] : level === 1 ? [good, bad] : [bad];
      c.f.sessions = c.f.items.map(item => ({
        ...session('warmup'),
        items: [item, dynamic],
      }));
      return c;
    },
  },
  {
    id: 'session.cooldown.stretch',
    make: level => {
      const c = context('session.cooldown.stretch'),
        e = r.data.exercises.find(
          e => e.primaryMuscles?.length === 1 && e.primaryMuscles.includes('quadriceps') && e.modality === 'strength',
        )!,
        stretch = r.data.exercises.find(e => e.mobility_type === 'static' && e.stretch_targets?.includes('quads'))!,
        t = session('main');
      t.items[0].exerciseId = e.id;
      const cooldown = session('cooldown', level * 30).items[0];
      cooldown.exerciseId = stretch.id;
      t.items.push(cooldown);
      c.f.rt = [t];
      return c;
    },
  },
  ...[
    'dose.sets_week.beginner',
    'dose.sets_week.intermediate',
    'dose.sets_week.goal_matrix',
    'progression.new.weekly_sets',
  ].map(id => ({
    id,
    make: (level: 0 | 1 | 2) => {
      const c = context(id);
      c.p.level = id.includes('intermediate') ? 'intermediate' : 'beginner';
      if (id === 'progression.new.weekly_sets') c.p.trainingAgeWeeks = 0;
      const full = id === 'dose.sets_week.intermediate' ? 10 : id === 'progression.new.weekly_sets' ? 4 : 6;
      return allSets(c, (level * full) / 2);
    },
  })),
  {
    id: 'dose.sets_exercise',
    make: level => {
      const c = context('dose.sets_exercise');
      expose(c, 1, level === 2 ? 2 : level === 1 ? 1 : 6);
      return c;
    },
  },
  {
    id: 'select.unilateral.weekly',
    binary: true,
    make: level => {
      const c = context('select.unilateral.weekly');
      if (level > 0) {
        const e = r.data.exercises.find(e => e.primary_pattern === 'lunge')!,
          t = session('main');
        t.items[0].exerciseId = e.id;
        c.f.items = t.items;
      }
      return c;
    },
  },
  {
    id: 'balance.week.pull_push',
    make: level => {
      const c = context('balance.week.pull_push');
      c.p.equipment = ['none', 'dumbbell', 'flat-bench', 'cable', 'resistance-band', 'pull-up-bar'];
      const push = r.data.exercises.find(e => e.primary_pattern === 'push_horizontal')!,
        pull = r.data.exercises.find(e => e.primary_pattern === 'pull_horizontal')!,
        a = session('main').items[0],
        b = session('main').items[0];
      a.exerciseId = push.id;
      a.sets = 2;
      b.exerciseId = pull.id;
      b.sets = level;
      c.f.items = [a, b];
      return c;
    },
  },
  {
    id: 'balance.week.hinge_knee',
    make: level => {
      const c = context('balance.week.hinge_knee'),
        knee = r.data.exercises.find(e => e.primary_pattern === 'squat')!,
        hinge = r.data.exercises.find(e => e.primary_pattern === 'hinge')!,
        a = session('main').items[0],
        b = session('main').items[0];
      a.exerciseId = knee.id;
      a.sets = 2;
      b.exerciseId = hinge.id;
      b.sets = level;
      c.f.items = [a, b];
      return c;
    },
  },
  {
    id: 'balance.week.core_three',
    make: level => {
      const c = context('balance.week.core_three');
      c.f.rt = [session('main')];
      c.f.patterns = new Set(level === 2 ? ['anti_extension', 'anti_rotation'] : level === 1 ? ['anti_extension'] : []);
      return c;
    },
  },
  {
    id: 'variety.rotation',
    unmeasured: true,
    make: () => context('variety.rotation'),
  },
  {
    id: 'caution.back.keep_active',
    make: level => {
      const c = context('caution.back.keep_active');
      c.p.cautions = ['back'];
      c.p.daysPerWeek = 2;
      c.f.sessions = Array.from({ length: level }, () => session());
      c.f.aerobic = level * 75;
      return c;
    },
  },
  {
    id: 'older.week.strength',
    make: level => {
      const c = context('older.week.strength');
      c.p.population = { kind: 'older_adult' };
      expose(c, level);
      return c;
    },
  },
  {
    id: 'older.week.multicomponent',
    make: level => {
      const c = context('older.week.multicomponent');
      c.p.population = { kind: 'older_adult' };
      c.p.daysPerWeek = 2;
      c.f.balanceDays = level;
      return c;
    },
  },
  {
    id: 'older.week.flexibility',
    make: level => {
      const c = context('older.week.flexibility');
      c.p.population = { kind: 'older_adult' };
      c.f.sessions = Array.from({ length: level }, () => {
        const t = session('cooldown', 60);
        t.items = muscles.map(g => {
          const e = r.data.exercises.find(e => e.mobility_type === 'static' && e.stretch_targets?.includes(g))!,
            item = session('cooldown', 60).items[0];
          item.exerciseId = e.id;
          return item;
        });
        return t;
      });
      return c;
    },
  },
  {
    id: 'older.template.balance_required',
    make: level => {
      const c = context('older.template.balance_required');
      c.p.population = { kind: 'older_adult' };
      c.p.daysPerWeek = 2;
      c.f.sessions = [session(), session()];
      c.f.balanceDays = level;
      return c;
    },
  },
  {
    id: 'pregnancy.week.target',
    make: level => {
      const c = context('pregnancy.week.target');
      c.p.population = {
        kind: 'pregnant',
        week: 20,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
      };
      c.f.sessions = Array.from({ length: level === 2 ? 3 : level }, () => session());
      c.f.rt = Array.from({ length: level }, () => session('main'));
      c.f.aerobic = level * 75;
      return c;
    },
  },
  {
    id: 'postpartum.weekly_target',
    make: level => {
      const c = context('postpartum.weekly_target');
      c.p.population = {
        kind: 'postpartum',
        weeksSinceBirth: 20,
        delivery: 'vaginal',
        cleared: true,
      };
      c.f.rt = Array.from({ length: level }, () => session('main'));
      c.f.aerobic = level * 75;
      return c;
    },
  },
  {
    id: 'duration.fit.tolerance',
    make: level => {
      const c = context('duration.fit.tolerance');
      c.f.sessions = [session('conditioning', level === 2 ? 1800 : level === 1 ? 2070 : 2400)];
      return c;
    },
  },
];
for (const name of ['start_moving', 'health', 'fat_loss', 'muscle', 'strength', 'mobility'] as const)
  matrices.push({
    id: `goal.params.${name}`,
    make: level => {
      const c = context(`goal.params.${name}`);
      c.p.goal = name;
      const v = c.v,
        days = v.rt_sessions_week.min;
      expose(c, level ? days : 0);
      allSets(c, level === 2 ? v.sets_per_muscle_week.min : 0);
      if (level) {
        for (const [index, t] of c.f.rt.entries()) {
          t.items = name === 'strength' ? [t.items[index % t.items.length]] : t.items;
          for (const i of t.items) {
            i.target = {
              metricType: 'reps',
              reps: name === 'strength' ? v.main_lift.reps[1] : v.reps.min,
            };
            i.prescription!.rir = name === 'strength' || name === 'muscle' ? [2, 2] : [v.rir.min, v.rir.max];
            if (name === 'mobility') {
              i.prescription!.tempo = {
                eccentricSeconds: v.eccentric_s,
                concentricSeconds: v.concentric_s,
                pauseSeconds: v.pause_s,
              };
              i.prescription!.secondsPerRep = Math.max(
                v.rep_duration_min_s,
                r.byExercise.get(i.exerciseId)!.time.s_per_rep ?? 0,
              );
            }
          }
        }
        const cardio = session('conditioning', 9000).items[0];
        cardio.prescription!.targetRpe = [5, 5];
        const stretch = r.data.exercises.find(e => e.modality === 'mobility')!;
        const mobility = session('mobility', 9000).items[0];
        mobility.exerciseId = stretch.id;
        c.f.sessions = Array.from(
          {
            length: Math.max(days, v.mobility_days_week?.min ?? v.mobility_sessions_week?.min ?? 0),
          },
          (_, i) => {
            const t = structuredClone(c.f.rt[i % days]);
            t.items.push(structuredClone(mobility));
            return t;
          },
        );
        c.f.items = [...c.f.rt.flatMap(t => t.items), cardio, mobility];
        c.f.seconds = 27000;
        c.f.resistance = 9000;
        c.f.mobility = 9000;
        c.f.aerobic = 300;
      }
      return c;
    },
  });
describe('D isolated target-statistics fixture matrix', () => {
  it('covers every registered target exactly once', () =>
    expect(matrices.map(x => x.id).sort()).toEqual(Object.keys(targetSatisfactions).sort()));
  for (const matrix of matrices)
    it(matrix.id, () => {
      if (matrix.unmeasured) {
        for (const level of [0, 1, 2] as const) expect(targetSatisfactions[matrix.id](matrix.make(level))).toBeNull();
        return;
      }
      const full = targetSatisfactions[matrix.id](matrix.make(2)),
        partial = targetSatisfactions[matrix.id](matrix.make(1)),
        zero = targetSatisfactions[matrix.id](matrix.make(0));
      expect(full).toBeCloseTo(1);
      expect(zero).toBe(0);
      if (matrix.binary) {
        expect(partial).toBe(1);
        return;
      }
      expect(partial).toBeGreaterThan(0);
      expect(partial).toBeLessThan(1);
    });
});

describe('D target subconditions use source facts rather than row-count coverage', () => {
  it('only introductory week one is exempt from the per-exercise minimum', () => {
    const c = expose(context('dose.sets_exercise'), 1, 1);
    c.p.trainingAgeWeeks = 1;
    expect(targetSatisfactions['dose.sets_exercise'](c)).toBe(0.5);
    c.p.trainingAgeWeeks = 0;
    expect(targetSatisfactions['dose.sets_exercise'](c)).toBe(1);
  });
  it('the whole-body floor includes each working exercise minimum', () => {
    const c = expose(context('goal.floor.all'), 2, 2);
    expect(targetSatisfactions['goal.floor.all'](c)).toBe(1);
    c.f.items[0].sets = 1;
    expect(targetSatisfactions['goal.floor.all'](c)).toBeLessThan(1);
  });
  it('older strength frequency applies its upper source boundary', () => {
    const c = expose(context('older.week.strength'), 2);
    c.p.population = { kind: 'older_adult' };
    expect(targetSatisfactions['older.week.strength'](c)).toBe(1);
    expose(c, 4);
    expect(targetSatisfactions['older.week.strength'](c)).toBeLessThan(1);
  });
  it('hard aerobic session count matters even when weekly minutes are below the cap', () => {
    const c = context('goal.interference.guard');
    c.f.hardAerobic = 4;
    const hard = session();
    hard.items[0].prescription!.targetRpe = [7, 7];
    c.f.sessions = [hard, hard, hard];
    expect(targetSatisfactions['goal.interference.guard'](c)).toBe(1);
    c.f.sessions.push(hard);
    expect(targetSatisfactions['goal.interference.guard'](c)).toBeLessThan(1);
  });
  it('keeping active for a back caution includes the unchanged aerobic target', () => {
    const c = context('caution.back.keep_active');
    c.p.cautions = ['back'];
    c.f.sessions = Array.from({ length: c.p.daysPerWeek }, () => session());
    expect(targetSatisfactions['caution.back.keep_active'](c)).toBe(0.5);
    c.f.aerobic = 150;
    expect(targetSatisfactions['caution.back.keep_active'](c)).toBe(1);
  });
  it('mobility cadence is measured from the actual prescription', () => {
    const c = matrices.find(m => m.id === 'goal.params.mobility')!.make(2);
    expect(targetSatisfactions['goal.params.mobility'](c)).toBe(1);
    delete c.f.rt[0].items[0].prescription!.tempo;
    expect(targetSatisfactions['goal.params.mobility'](c)).toBeLessThan(1);
  });
  it('strength main sets use their own source range', () => {
    const c = matrices.find(m => m.id === 'goal.params.strength')!.make(2);
    expect(targetSatisfactions['goal.params.strength'](c)).toBe(1);
    c.f.rt[0].items[0].sets = 4;
    expect(targetSatisfactions['goal.params.strength'](c)).toBeLessThan(1);
  });
  it('RIR zero cannot stand for every set of a muscle-goal exercise', () => {
    const c = matrices.find(m => m.id === 'goal.params.muscle')!.make(2);
    expect(targetSatisfactions['goal.params.muscle'](c)).toBe(1);
    c.f.rt[0].items[0].prescription!.rir = [0, 0];
    expect(targetSatisfactions['goal.params.muscle'](c)).toBeLessThan(1);
  });
});
