import { type Item, type ItemFacts, type Session, type SessionFacts, type Facts } from './types';
import { Rules } from '../data';
import { credit } from '../dose';
import { estimatedSeconds } from '../fit/elapsed-time';
import { type Plan } from '../contracts';

export function itemFacts(item: Item, r: Rules): ItemFacts {
  const e = r.byExercise.get(item.exerciseId),
    block = item.prescription?.block,
    work = block === 'main' || block === 'accessory',
    seconds =
      'durationSeconds' in item.target
        ? item.sets *
          item.target.durationSeconds *
          (item.prescription?.perSide || e?.time.per_side ? r.get('session.time.model').per_side_multiplier : 1)
        : 0,
    cardio = block === 'conditioning' && e?.modality === 'cardio',
    intensity = r.get('aerobic.intensity.rpe_scale'),
    rpe = item.prescription?.targetRpe?.[0] ?? 0;
  return {
    work,
    main: block === 'main',
    credit: work ? credit(item, r) : {},
    pattern: work ? e?.primary_pattern : undefined,
    patterns: work && e ? [e.primary_pattern, ...e.secondary_patterns] : [],
    conditioningSeconds: cardio ? seconds : 0,
    aerobic: cardio
      ? (seconds / 60) *
        (rpe >= intensity.vigorous[0]
          ? r.get('aerobic.target.weekly').vigorous_multiplier
          : rpe >= intensity.moderate[0]
            ? 1
            : 0)
      : 0,
    hardAerobic: cardio && rpe >= intensity.vigorous[0] ? seconds / 60 : 0,
    mobility: (block === 'mobility' || block === 'cooldown') && e?.modality === 'mobility' ? seconds : 0,
    balance:
      e?.primary_pattern === 'balance' &&
      block !== 'cooldown' &&
      (block !== 'warmup' || r.get('session.warmup.balance_older').counts_toward_balance_days !== false),
  };
}

/** Identity reuse is confined to an explicitly frozen candidate baseline, never mutable public input. */
export function sessionFacts(session: Session, r: Rules, unchanged?: Map<Item, ItemFacts>): SessionFacts {
  const items = session.items,
    contributions = new Map(items.map(item => [item, unchanged?.get(item) ?? itemFacts(item, r)])),
    work: Item[] = [],
    sets: Record<string, number> = {},
    mainSets: Record<string, number> = {},
    directSets: Record<string, number> = {},
    patterns: string[] = [];
  let aerobic = 0,
    hardAerobic = 0,
    conditioningSeconds = 0,
    mobility = 0,
    balance = false;
  for (const item of items) {
    const fact = contributions.get(item)!;
    if (fact.work) work.push(item);
    for (const [group, n] of Object.entries(fact.credit)) {
      sets[group] = (sets[group] ?? 0) + n;
      if (fact.main) mainSets[group] = (mainSets[group] ?? 0) + n;
    }
    if (fact.pattern) directSets[fact.pattern] = (directSets[fact.pattern] ?? 0) + item.sets;
    patterns.push(...fact.patterns);
    aerobic += fact.aerobic;
    hardAerobic += fact.hardAerobic;
    conditioningSeconds += fact.conditioningSeconds;
    mobility += fact.mobility;
    balance = balance || fact.balance;
  }
  const seconds = estimatedSeconds(session, r);
  return {
    session,
    items,
    work,
    contributions,
    sets,
    mainSets,
    directSets,
    setEntries: Object.entries(sets),
    directSetEntries: Object.entries(directSets),
    seconds,
    resistance:
      work.length === items.length ? seconds : work.length ? estimatedSeconds({ ...session, items: work }, r) : 0,
    patterns,
    aerobic,
    hardAerobic,
    conditioningSeconds,
    mobility,
    balance,
  };
}

/** Fold each statistic in original template order, preserving its floating-point addition order. */
export function aggregate(parts: SessionFacts[]): Facts {
  const sets: Record<string, number> = {},
    exposures: Record<string, number> = {},
    directSets: Record<string, number> = {};
  const sessions: Session[] = [],
    items: Item[] = [],
    rt: Session[] = [],
    patterns = new Set<string>(),
    primaryPatterns = new Set<string>();
  const sessionPatterns: Set<string>[] = [],
    sessionSeconds = new Map<Session, number>(),
    mainSetsBySession = new Map<Session, Record<string, number>>();
  let aerobic = 0,
    hardAerobic = 0,
    seconds = 0,
    resistance = 0,
    mobility = 0,
    balanceDays = 0,
    conditioningSeconds = 0;
  for (const part of parts) {
    sessions.push(part.session);
    items.push(...part.items);
    sessionSeconds.set(part.session, part.seconds);
    mainSetsBySession.set(part.session, part.mainSets);
    if (part.work.length) {
      rt.push(part.session);
      sessionPatterns.push(new Set(Object.keys(part.directSets)));
    }
    for (const [pattern, n] of part.directSetEntries) {
      directSets[pattern] = (directSets[pattern] ?? 0) + n;
      primaryPatterns.add(pattern);
    }
    for (const [group, n] of part.setEntries) {
      if (n > 0) exposures[group] = (exposures[group] ?? 0) + 1;
      sets[group] = (sets[group] ?? 0) + n;
    }
    for (const pattern of part.patterns) patterns.add(pattern);
    aerobic += part.aerobic;
    hardAerobic += part.hardAerobic;
    seconds += part.seconds;
    resistance += part.resistance;
    mobility += part.mobility;
    conditioningSeconds += part.conditioningSeconds;
    if (part.balance) balanceDays++;
  }
  return {
    mainSetsBySession,
    primaryPatterns,
    sessionPatterns,
    sessionSeconds,
    exposures,
    directSets,
    conditioningSeconds,
    sessions,
    items,
    rt,
    sets,
    patterns,
    aerobic,
    hardAerobic,
    seconds,
    resistance,
    mobility,
    balanceDays,
  };
}

export function facts(plan: Plan, r: Rules): Facts {
  return aggregate(plan.templates.map(t => sessionFacts(t, r)));
}
