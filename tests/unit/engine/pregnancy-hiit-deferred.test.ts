import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { createContext } from '../../../src/engine/pipeline';
import { checkHard } from '../../../src/engine/hard-checks';
import { fixtureProfile, sessionFixture } from './fixtures';
const r = new Rules();
it('retains the historical95 entries with exactly one explicitly deferred mechanic, not a fake hard pass', () => {
  const deferred = r.byId.get('pregnancy.hiit') as {
    deferred?: boolean;
    severity?: string;
  };
  expect(deferred.deferred).toBe(true);
  expect(deferred.severity).toBe('mechanic');
  expect(r.data.rules.filter(rule => rule.severity === 'hard')).toHaveLength(95);
  expect(r.byId.get('hiit.gate.unlock')?.severity).toBe('hard');
});
it('rejects an explicitly HIIT-marked plan for a pregnant profile even with general clearance and week evidence', () => {
  const p = {
      ...structuredClone(fixtureProfile),
      population: {
        kind: 'pregnant' as const,
        week: 12,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 12,
      },
      screening: {
        ...fixtureProfile.screening,
        activityStatus: 'active' as const,
        activityEvidence: {
          consecutiveRegularWeeks: 100,
          noSymptomReportsWeeks: 100,
        },
      },
    },
    ctx = createContext(p, 0, r),
    t = sessionFixture();
  t.items[0].prescription!.trainingStyle = 'hiit';
  const plan = {
    weeklyTarget: 1,
    sessionMinutes: 30,
    templates: [t],
    trace: [],
    notices: [],
    gates: ctx.gate.reasons,
    meta: {
      engineVersion: 'test',
      rulesVersion: r.data.rulesVersion,
      seed: 'test',
    },
  };
  expect(ctx.gate.restrictions.user.hiit_unlocked).toBe(false);
  expect(
    checkHard(plan, p, ctx.gate, r).some(issue => issue.code === 'hiit_locked' && issue.ruleId === 'hiit.gate.unlock'),
  ).toBe(true);
  const text = r.text('pregnancy.copy.hiit_deferred');
  expect(text.zh).toContain('本版本孕期不提供');
  expect(ctx.gate.notices.some(n => n.code === 'pregnancy.copy.hiit_deferred')).toBe(false);
});
