import { afterEach, expect, it, vi } from 'vitest';
import { beginDefaultScorerBatch, createGenerationScorer, marginal, scorePlan } from '../../../src/engine/score';
import * as timing from '../../../src/engine/fit/elapsed-time';
import { Rules } from '../../../src/engine/data';
import { fixtureProfile, planFixture } from './fixtures';
import { improve } from '../../../src/engine/improve';
import { createContext } from '../../../src/engine/pipeline';
const rules = new Rules();
function fixture() {
  const plan = planFixture(),
    base = plan.templates[0];
  plan.templates = [0, 1, 2].map(index => {
    const t = structuredClone(base);
    t.id = `timing-${index}`;
    t.items[0].prescription!.targetRpe = [5, 5];
    t.items[0].prescription!.warmupSeconds = 0;
    for (const block of ['warmup', 'cooldown'] as const)
      t.items.push({
        ...structuredClone(t.items[0]),
        target: { metricType: 'duration', durationSeconds: 100 },
        prescription: { ...t.items[0].prescription!, block },
      });
    return t;
  });
  return plan;
}
afterEach(() => vi.restoreAllMocks());
it('reuses only unchanged baseline sessions inside one explicit default batch', () => {
  const plan = Object.freeze(fixture()),
    scorer = createGenerationScorer(),
    end = beginDefaultScorerBatch(scorer, plan, fixtureProfile, rules),
    spy = vi.spyOn(timing, 'actualWarmupSeconds');
  try {
    scorer.score(plan, fixtureProfile, rules);
    expect(spy).toHaveBeenCalledTimes(3);
    const item = structuredClone(plan.templates[1].items[1]);
    item.target = { metricType: 'duration', durationSeconds: 140 };
    const next = {
        ...plan,
        templates: plan.templates.map((t, index) =>
          index === 1 ? { ...t, items: t.items.map((i, n) => (n === 1 ? item : i)) } : t,
        ),
      },
      expected = scorePlan(next, fixtureProfile, rules).quality - scorePlan(plan, fixtureProfile, rules).quality;
    spy.mockClear();
    const change = { kind: 'replace' as const, templateId: plan.templates[1].id, itemIndex: 1, item };
    expect(scorer.marginal(plan, change, fixtureProfile, rules)).toBe(expected);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();
    expect(scorer.marginal(plan, change, fixtureProfile, rules)).toBe(expected);
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    end();
  }
});
it('recomputes a changed session instead of reusing its old warmup value', () => {
  const plan = fixture(),
    scorer = createGenerationScorer(),
    end = beginDefaultScorerBatch(scorer, plan, fixtureProfile, rules);
  try {
    scorer.score(plan, fixtureProfile, rules);
    const next = { ...plan, templates: plan.templates.map((t, i) => (i === 0 ? structuredClone(t) : t)) };
    next.templates[0].items[1].target = { metricType: 'duration', durationSeconds: 170 };
    const expected = scorePlan(next, fixtureProfile, rules),
      spy = vi.spyOn(timing, 'actualWarmupSeconds');
    expect(scorer.score(next, fixtureProfile, rules)).toEqual(expected);
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    end();
  }
});
it('destroys timing scope before mutable plan, profile and same-Rules edits', () => {
  const plan = fixture(),
    profile = structuredClone(fixtureProfile),
    r = new Rules(structuredClone(rules.data)),
    scorer = createGenerationScorer(),
    end = beginDefaultScorerBatch(scorer, plan, profile, r);
  scorer.score(plan, profile, r);
  end();
  plan.templates[0].items[1].target = { metricType: 'duration', durationSeconds: 170 };
  profile.sessionMinutes = 45;
  r.get('duration.set.overhead').overhead_s_per_set = 25;
  const expected = scorePlan(plan, profile, r),
    spy = vi.spyOn(timing, 'actualWarmupSeconds');
  expect(scorer.score(plan, profile, r)).toEqual(expected);
  expect(spy).toHaveBeenCalledTimes(3);
});
it('does not memoize public scorePlan or a custom scorer even when a batch hook is called', () => {
  const plan = Object.freeze(fixture()),
    custom = { score: scorePlan, marginal },
    end = beginDefaultScorerBatch(custom, plan, fixtureProfile, rules),
    spy = vi.spyOn(timing, 'actualWarmupSeconds');
  try {
    custom.score(plan, fixtureProfile, rules);
    custom.score(plan, fixtureProfile, rules);
    expect(spy).toHaveBeenCalledTimes(6);
  } finally {
    end();
  }
});
it('does not activate internal timing for a user callback scorer in improve', () => {
  const plan = fixture(),
    custom = { score: vi.fn(scorePlan), marginal: vi.fn(() => 0) },
    before = JSON.stringify(plan);
  const out = improve(plan, createContext(fixtureProfile, 0, rules), custom, 1);
  expect(custom.score).toHaveBeenCalled();
  expect(out.templates).toEqual(plan.templates);
  expect(JSON.stringify(plan)).toBe(before);
});
it('cleans up an explicit scope in finally when evaluation throws', () => {
  const plan = fixture(),
    scorer = createGenerationScorer(),
    spy = vi.spyOn(timing, 'actualWarmupSeconds');
  try {
    const end = beginDefaultScorerBatch(scorer, plan, fixtureProfile, rules);
    try {
      scorer.score(plan, fixtureProfile, rules);
      throw Error('test failure');
    } finally {
      end();
    }
  } catch (error) {
    expect((error as Error).message).toBe('test failure');
  }
  spy.mockClear();
  scorer.score(plan, fixtureProfile, rules);
  expect(spy).toHaveBeenCalledTimes(3);
});
