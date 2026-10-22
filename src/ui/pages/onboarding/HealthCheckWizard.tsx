import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TEXT_LIMITS, textIssue } from '../../../domain/input-guard';
import { FieldIssue } from '../../components/common/FieldIssue';
import { createPregnancyReconfirmationDraft, pregnancyPopulationFromDraft } from '../../../application/pregnancy-safety';
import { painQuestionKeys } from '../../../application/pain-events';
import type { EngineProfileFields } from '../../../application/engine-profile';
import type { EngineProfile } from '../../../engine/contracts';
import { Rules } from '../../../engine/data';
import { engineCopy } from '../../../coach/engine-copy';
import { entryCopy, fill } from '../../../i18n/features/onboarding/entry';
import zhCopy from '../../../i18n/features/onboarding/zh.json';
import enCopy from '../../../i18n/features/onboarding/en.json';
import { BigChoice, ChoiceChip, PrimaryButton, Card, Yaya } from '../../components/kit';
import { useEngineProfileDraft, engineFallKeys, engineOlderAge } from '../settings/EngineProfileEditor';
import { OnboardingFrame } from './OnboardingFrame';
import { BirthMonthField } from '../../components/BirthMonthField';
import type { OnboardingAnswers } from './OnboardingPage';
import { PlanModeChoice, useAiReadiness } from './PlanModeChoice';
import { planModeCopy, type MissingKey } from '../../../i18n/features/onboarding/plan-mode';

const rules = new Rules();
const cmrKeys = rules.get('safety.screen.cmr_symptoms').symptoms as string[];
const age45 = rules.get('safety.age45.vigorous_advisory').age_min_years as number;
const parts = ['knee', 'back', 'shoulder', 'wrist', 'other'] as const;
type Group = 'parq' | 'cmr' | 'other' | 'preg' | 'falls' | 'redflag';
interface Item { key: string; text: string; value: boolean | undefined; set: (answer: boolean) => void }
interface Screen { id: string; group?: Group; item?: Item; index?: number; total?: number }

interface HealthCheckWizardProps {
  locale: 'zh' | 'en'; answers: OnboardingAnswers; engineEnabled: boolean; bodyEnabled: boolean;
  mode: 'ai' | 'basic'; busy: boolean; error?: string; step: number; total: number; complete: boolean;
  sendFields: [string, string | number][];
  onChange: (answers: OnboardingAnswers) => void; onExit: () => void; onGenerate: () => void; onManual: () => void;
  /** 回到今天 (after confirming, unsaved answers are cleared). */
  onHome?: () => void;
  /** Starting screen id (tests and resuming); defaults to the first screen. */
  initialScreen?: string;
  /** AI planning exists in this deployment: 芽芽 asks AI-or-local before the ready screen. */
  aiAvailable?: boolean;
  /** Earlier onboarding answers still missing, with the outer step that fixes each. */
  missingOuter?: { key: MissingKey; step: number }[];
  onOuterStep?: (step: number) => void;
}

/** Big 是/否 pair; the parent advances after an answer. */
function YesNo({ value, onAnswer, yes, no, disabled }: { value: boolean | undefined; onAnswer: (answer: boolean) => void; yes: string; no: string; disabled?: boolean }) {
  return <div className="v9-yesno" role="radiogroup">
    <BigChoice label={yes} selected={value === true} disabled={disabled} onClick={() => onAnswer(true)} />
    <BigChoice label={no} selected={value === false} disabled={disabled} onClick={() => onAnswer(false)} />
  </div>;
}

/**
 * The health self-check, one question per screen. It reuses the settings editor's draft hook, so every
 * answer is written to exactly the same fields with the same completeness rules; only presentation differs.
 */
export function HealthCheckWizard(props: HealthCheckWizardProps) {
  const { locale, answers, engineEnabled, bodyEnabled, mode, busy, error, step, total, complete, sendFields, onChange, onExit, onGenerate, onManual } = props;
  const t = entryCopy[locale], legacy = locale === 'zh' ? zhCopy : enCopy;
  const engineChange = (fields: EngineProfileFields) => onChange({ ...answers, ...fields, ...(!fields.healthStorageConsent ? { healthStorageConsent: undefined, screening: undefined, population: undefined, birthYearMonth: undefined, painState: undefined, powerOneRm: undefined, postpartumRisk: undefined } : {}) });
  const d = useEngineProfileDraft({ value: answers, onChange: engineChange, locale, ageYears: answers.body?.age });
  const requiredAt = useRef(new Date().toISOString());
  const consent = !!answers.healthStorageConsent, minor = bodyEnabled && answers.body?.age !== undefined && answers.body.age < 18;
  const engine = engineEnabled && consent;
  const male = answers.body?.biologicalSex === '男性';
  const kind = d.populationKind;
  const [expanded, setExpanded] = useState<Set<Group>>(() => new Set<Group>([
    ...(d.answers.some(value => value === true) ? ['parq' as const] : []),
    ...(Object.values(d.cmrAnswers).some(Boolean) ? ['cmr' as const] : []),
    ...(d.extra.knownCondition || d.extra.acuteIllness ? ['other' as const] : []),
  ]));
  const [cautionMode, setCautionMode] = useState<'none' | 'some' | undefined>(answers.cautions.length ? 'some' : answers.safetyAnswered ? 'none' : undefined);
  const [current, setCurrent] = useState(props.initialScreen ?? 'intro');
  const [advance, setAdvance] = useState<{ from: string; nonce: number }>();

  const screening = answers.screening;
  const redAreas = answers.cautions.filter(area => area !== 'other');
  const redKeys = redAreas.length ? painQuestionKeys(redAreas) : [];
  const setRedflag = (next: Record<string, boolean>) => {
    if (!screening) return;
    const prior = screening.redFlagReview;
    onChange({ ...answers, screening: { ...screening, redFlagReview: { requiredAt: prior?.requiredAt ?? requiredAt.current, areas: redAreas, questionKeys: redKeys, answers: next, ...(redKeys.every(key => typeof next[key] === 'boolean') ? { answeredAt: new Date().toISOString() } : {}) } } });
  };
  function choosePopulation(next: string) {
    d.setPopulationKind(next); d.setPopulationDraft({}); d.setPregnancyDraft(createPregnancyReconfirmationDraft());
    d.setFallsAnswers(Array.from({ length: engineFallKeys.length }, () => undefined));
    engineChange({ ...answers, population: next === 'pregnant' ? pregnancyPopulationFromDraft(createPregnancyReconfirmationDraft()) : next === 'general' ? { kind: 'general' } : next === 'older_adult' ? { kind: 'older_adult' } : undefined });
  }
  function setFalls(next: (boolean | undefined)[]) {
    d.setFallsAnswers(next); d.setPopulationKind('older_adult');
    const prior = answers.population?.kind === 'older_adult' ? answers.population : { kind: 'older_adult' as const };
    const known = next.every(value => typeof value === 'boolean');
    engineChange({ ...answers, population: { ...prior, fallsAnswers: known ? next as boolean[] : undefined, walkingAid: next[3], balanceCautious: next.some(value => value === true) ? true : known ? false : undefined } });
  }

  const groups: Record<Group, Item[]> = {
    parq: d.answers.map((value, index) => ({ key: `parq:${index}`, text: engineCopy(`safety.copy.parq_${index + 1}`, locale), value, set: answer => { const next = [...d.answers]; next[index] = answer; d.update(next); } })),
    cmr: cmrKeys.map(key => ({ key: `cmr:${key}`, text: engineCopy(`safety.copy.cmr_${key}`, locale), value: d.cmrAnswers[key], set: answer => d.update(d.answers, d.extra, { ...d.cmrAnswers, [key]: answer }) })),
    other: [
      { key: 'other:known', text: t.other.known, value: d.extra.knownCondition, set: answer => d.update(d.answers, { ...d.extra, knownCondition: answer }) },
      { key: 'other:acute', text: t.other.acute, value: d.extra.acuteIllness, set: answer => d.update(d.answers, { ...d.extra, acuteIllness: answer }) },
    ],
    preg: [...d.absoluteList, ...d.relativeList].map(row => ({ key: `preg:${row.key}`, text: row.text, value: d.contraindicationAnswers[row.key], set: answer => d.changePregnancy({ type: 'contraindication', key: row.key, answer }) })),
    falls: engineFallKeys.map((key, index) => ({ key: `falls:${key}`, text: engineCopy(`older.screen.copy.${key}`, locale), value: d.fallsAnswers[index], set: answer => { const next = [...d.fallsAnswers]; next[index] = answer; setFalls(next); } })),
    redflag: redKeys.map(key => ({ key: `redflag:${key}`, text: engineCopy(`redflag.copy.question_${key}`, locale), value: screening?.redFlagReview?.answers?.[key], set: answer => setRedflag({ ...screening?.redFlagReview?.answers, [key]: answer }) })),
  };
  const allNo: Record<Group, () => void> = {
    parq: () => d.update(d.answers.map(() => false)),
    cmr: () => d.update(d.answers, d.extra, Object.fromEntries(cmrKeys.map(key => [key, false]))),
    other: () => d.update(d.answers, { ...d.extra, knownCondition: false, acuteIllness: false }),
    preg: () => d.changePregnancyAll([...d.absoluteList, ...d.relativeList].map(row => ({ type: 'contraindication' as const, key: row.key, answer: false }))),
    falls: () => setFalls(engineFallKeys.map(() => false)),
    redflag: () => setRedflag(Object.fromEntries(redKeys.map(key => [key, false]))),
  };

  const age = d.currentAge;
  const showFalls = engine && (kind === 'general' || kind === 'older_adult') && age !== undefined && age >= engineOlderAge;
  const screens = (() => {
    const list: Screen[] = [{ id: 'intro' }];
    const group = (name: Group) => {
      list.push({ id: `group:${name}`, group: name });
      if (expanded.has(name)) groups[name].forEach((item, index, all) => list.push({ id: `q:${item.key}`, group: name, item, index, total: all.length }));
    };
    if (engine) {
      list.push({ id: 'birth' });
      group('parq'); group('cmr'); group('other');
      list.push({ id: 'activity' }, { id: 'bp' });
      if (!male || (kind !== 'general' && kind !== 'older_adult')) list.push({ id: 'population' });
      if (kind === 'pregnant') { list.push({ id: 'preg:week' }, { id: 'preg:prenatal' }, { id: 'preg:provider' }); group('preg'); list.push({ id: 'preg:info' }); }
      if (kind === 'postpartum') list.push({ id: 'pp:week' }, { id: 'pp:provider' }, { id: 'pp:delivery' });
      if (showFalls) group('falls');
      if (age !== undefined && age >= age45 && d.screen?.completedAt) list.push({ id: 'age45' });
    }
    list.push({ id: 'cautions' });
    if (engine && redKeys.length && screening) group('redflag');
    if (engine) list.push({ id: 'prefs' });
    if (props.aiAvailable) list.push({ id: 'planMode' });
    list.push({ id: 'ready' });
    return list;
  })();
  // If an answer removes the current screen (e.g. changing 孕产状态), stay at the same position instead of restarting.
  const lastIndex = useRef(0), found = screens.findIndex(screen => screen.id === current);
  const index = found >= 0 ? found : Math.min(lastIndex.current, screens.length - 1);
  lastIndex.current = index;
  const screen = screens[index] ?? screens[0];
  const go = (offset: number) => { const next = index + offset; if (next < 0) onExit(); else setCurrent(screens[Math.min(screens.length - 1, next)].id); };
  // Answers change the screen list (e.g. 在孕期 adds follow-ups); advance after the list is rebuilt.
  useEffect(() => { if (advance && advance.from === screen.id) go(1); }, [advance]);
  const answerThen = (apply: () => void) => { apply(); setAdvance({ from: screen.id, nonce: Date.now() }); };

  const answered = (name: Group) => groups[name].every(item => typeof item.value === 'boolean');
  const nextButton = (enabled: boolean, label: string = t.next) => <PrimaryButton disabled={busy || !enabled} onClick={() => go(1)}>{label}</PrimaryButton>;
  const frame = (title: ReactNode, body: ReactNode, footer?: ReactNode, sub?: ReactNode, counter?: string) => <OnboardingFrame locale={locale} step={step} total={total} within={(index + 1) / screens.length}
    screenKey={screen.id} title={title} sub={sub} counter={counter} onBack={() => go(-1)} backDisabled={busy} onHome={props.onHome} footer={footer} busy={busy}>{body}</OnboardingFrame>;
  const groupCopy: Record<Group, { title: string; sub?: string }> = {
    parq: t.parq, cmr: t.cmr, other: { title: t.other.title }, preg: { title: t.pregnancyList, sub: engineCopy('pregnancy.gate.copy.intro', locale) },
    falls: { title: engineCopy('older.screen.copy.intro', locale) }, redflag: t.redflag,
  };

  const pm = planModeCopy[locale];
  const ai = useAiReadiness(!!props.aiAvailable && answers.planMode === 'ai');
  switch (true) {
    case screen.id === 'planMode': {
      const canGo = answers.planMode === 'local' || answers.planMode === 'ai' && ai.readiness === 'active';
      return frame(pm.title, <PlanModeChoice locale={locale} value={answers.planMode} busy={busy} engineEnabled={engineEnabled} readiness={ai.readiness} onRefresh={ai.refresh}
        onChange={planMode => onChange({ ...answers, planMode })} />, nextButton(canGo), pm.sub);
    }
    case screen.id === 'intro': {
      const ready = answers.adultConfirmed && (!engineEnabled || consent);
      return frame(t.intro.title, <div className="v9-choices">
        {engineEnabled && <p className="v9-onboarding-note">{engineCopy('safety.copy.disclaimer', locale)}</p>}
        <BigChoice kind="check" label={t.intro.adult} selected={answers.adultConfirmed} disabled={busy || minor} onClick={() => onChange({ ...answers, adultConfirmed: !answers.adultConfirmed })} />
        {engineEnabled && <BigChoice kind="check" label={engineCopy('safety.copy.local_health_consent', locale)} selected={consent} disabled={busy}
          onClick={() => engineChange(consent ? {} : { ...answers, healthStorageConsent: { acceptedAt: new Date().toISOString() } })} />}
        {(minor || !answers.adultConfirmed) && <p className="v9-onboarding-note">{t.intro.minor}</p>}
      </div>, <><PrimaryButton disabled={busy || !ready} onClick={() => {
        // A man is never asked about pregnancy; record the same answer the selector would ("neither").
        if (engine && male && !answers.population) choosePopulation('general');
        go(1);
      }}>{t.next}</PrimaryButton>
      <PrimaryButton tone="text" size="md" disabled={busy} onClick={onManual}>{t.ready.manual}</PrimaryButton></>);
    }
    case screen.id === 'birth':
      return frame(t.birth.title, <div className="v9-field" role="group" aria-label={t.birth.label}><BirthMonthField locale={locale} value={answers.birthYearMonth} disabled={busy} onChange={birthYearMonth => engineChange({ ...answers, birthYearMonth })} /></div>,
        nextButton(!!answers.birthYearMonth), t.birth.sub);
    case screen.id.startsWith('group:'): {
      const name = screen.group!, items = groups[name], open = expanded.has(name), copy = groupCopy[name];
      return frame(copy.title, <>
        <Card variant="inset" padding="md" as="section"><ul className="v9-check-list">{items.map(item => <li key={item.key} data-answer={item.value === undefined ? 'unknown' : item.value ? 'yes' : 'no'}>{item.text}</li>)}</ul></Card>
      </>, <>
        <PrimaryButton disabled={busy} onClick={() => answerThen(() => { allNo[name](); setExpanded(previous => { const next = new Set(previous); next.delete(name); return next; }); })}>{t.none}</PrimaryButton>
        {open && answered(name) ? <PrimaryButton tone="quiet" disabled={busy} onClick={() => go(1)}>{t.next}</PrimaryButton>
          : <PrimaryButton tone="quiet" disabled={busy} onClick={() => answerThen(() => setExpanded(previous => new Set(previous).add(name)))}>{t.some}</PrimaryButton>}
      </>, copy.sub);
    }
    case screen.id.startsWith('q:'): {
      const item = screen.item!;
      return frame(item.text, <YesNo value={item.value} yes={t.yes} no={t.no} disabled={busy} onAnswer={answer => answerThen(() => item.set(answer))} />,
        typeof item.value === 'boolean' ? nextButton(true) : undefined, undefined, fill(t.question, { index: (screen.index ?? 0) + 1, total: screen.total ?? 1 }));
    }
    case screen.id === 'activity':
      return frame(t.activity.title, <div className="v9-choices" role="radiogroup">
        {(['active', 'inactive'] as const).map(value => <BigChoice key={value} label={value === 'active' ? t.activity.yes : t.activity.no} selected={d.extra.activityStatus === value} disabled={busy} onClick={() => answerThen(() => d.update(d.answers, { ...d.extra, activityStatus: value }))} />)}
      </div>, d.extra.activityStatus ? nextButton(true) : undefined, t.activity.sub);
    case screen.id === 'bp':
      return frame(t.bp.title, <div className="v9-choices" role="radiogroup">
        {([['known_below_threshold', t.bp.low], ['ge_160_90', t.bp.high], ['unknown', t.bp.unknown]] as const).map(([value, label]) => <BigChoice key={value} label={label} selected={d.extra.restingBp === value} disabled={busy}
          onClick={() => answerThen(() => d.update(d.answers, { ...d.extra, restingBp: value as EngineProfile['screening']['restingBp'] }))} />)}
      </div>, d.extra.restingBp ? nextButton(true) : undefined, t.bp.sub);
    case screen.id === 'population': {
      const selected = kind === 'older_adult' ? 'general' : kind;
      return frame(t.population.title, <div className="v9-choices" role="radiogroup">
        {(['general', 'pregnant', 'postpartum'] as const).map(value => <BigChoice key={value} label={t.population[value]} selected={selected === value} disabled={busy}
          onClick={() => answerThen(() => { if (selected !== value) choosePopulation(value); })} />)}
      </div>, selected ? nextButton(true) : undefined, t.population.sub);
    }
    case screen.id === 'preg:week' || screen.id === 'pp:week': {
      const weeks = d.populationDraft.weeks;
      const limit = screen.id === 'preg:week' ? 42 : 104;
      const set = (value: number | undefined) => d.updatePopulation({ ...d.populationDraft, weeks: value === undefined || !Number.isFinite(value) ? undefined : Math.min(limit, Math.max(0, Math.round(value))) });
      return frame(screen.id === 'preg:week' ? t.pregnancyWeek : t.postpartumWeek, <div className="v9-stepper">
        <button type="button" className="v9-round v8-press" aria-label={t.fewer} disabled={busy || !weeks} onClick={() => set(Math.max(0, (weeks ?? 1) - 1))}>−</button>
        <input className="v9-num" type="number" min="0" max={limit} step="1" inputMode="numeric" aria-label={screen.id === 'preg:week' ? t.pregnancyWeek : t.postpartumWeek} value={weeks ?? ''} disabled={busy}
          onChange={event => set(event.target.value === '' ? undefined : Number(event.target.value))} />
        <button type="button" className="v9-round v8-press" aria-label={t.more} disabled={busy || (weeks ?? 0) >= limit} onClick={() => set((weeks ?? 0) + 1)}>+</button>
      </div>, nextButton(weeks !== undefined));
    }
    case screen.id === 'preg:prenatal':
      return frame(engineCopy('pregnancy.gate.copy.prenatal_checkups_question', locale), <>
        <YesNo value={d.pregnancyDraft.prenatalCareConfirmed} yes={t.yes} no={t.no} disabled={busy} onAnswer={answer => answerThen(() => d.changePregnancy({ type: 'prenatal', answer }))} />
        {d.pregnancyDraft.prenatalCareConfirmed === false && <p className="v9-onboarding-note">{engineCopy('pregnancy.gate.copy.ask_provider', locale)}</p>}
      </>, d.pregnancyDraft.prenatalCareConfirmed !== undefined ? nextButton(true) : undefined);
    case screen.id === 'preg:provider': {
      const value = d.populationDraft.provider !== undefined ? !d.populationDraft.provider : undefined;
      return frame(engineCopy('pregnancy.gate.copy.provider_question', locale), <YesNo value={value} yes={t.yes} no={t.no} disabled={busy}
        onAnswer={answer => answerThen(() => d.updatePopulation({ ...d.populationDraft, provider: !answer }))} />, value !== undefined ? nextButton(true) : undefined);
    }
    case screen.id === 'preg:info':
      return frame(t.pregnancyInfo, <Card variant="inset" padding="md" as="section" className="v9-onboarding-notes">
        <p>{engineCopy('pregnancy.gate.copy.app_limit', locale)}</p><p>{engineCopy('pregnancy.environment.copy.heat', locale)}</p><p>{engineCopy('pregnancy.environment.copy.altitude', locale)}</p>
      </Card>, nextButton(true));
    case screen.id === 'pp:provider':
      return frame(t.postpartumProvider, <YesNo value={d.populationDraft.provider} yes={t.yes} no={t.no} disabled={busy}
        onAnswer={answer => answerThen(() => d.updatePopulation({ ...d.populationDraft, provider: answer }))} />, d.populationDraft.provider !== undefined ? nextButton(true) : undefined);
    case screen.id === 'pp:delivery':
      return frame(t.delivery.title, <div className="v9-choices" role="radiogroup">
        {([['vaginal', t.delivery.vaginal], ['assisted_or_tear', t.delivery.assisted], ['cesarean', t.delivery.cesarean]] as const).map(([value, label]) => <BigChoice key={value} label={label} selected={d.populationDraft.delivery === value} disabled={busy}
          onClick={() => answerThen(() => d.updatePopulation({ ...d.populationDraft, delivery: value }))} />)}
      </div>, d.populationDraft.delivery ? nextButton(true) : undefined);
    case screen.id === 'age45': {
      const screen45 = d.screen!, acknowledged = screen45.age45AdvisoryAck?.screenedAt === screen45.completedAt;
      return frame(t.age45.title, <div className="v9-choices"><p className="v9-onboarding-note">{engineCopy('safety.copy.age45_advisory', locale)}</p>
        <BigChoice kind="check" label={t.age45.ack} selected={acknowledged} disabled={busy} onClick={() => engineChange({ ...answers, screening: { ...screen45, age45AdvisoryAck: acknowledged ? undefined : { acknowledgedAt: new Date().toISOString(), screenedAt: screen45.completedAt! } } })} />
      </div>, nextButton(true));
    }
    case screen.id === 'cautions':
      return frame(t.cautions.title, <div className="v9-choices">
        <div role="radiogroup" className="v9-choices">
          <BigChoice label={t.cautions.none} selected={cautionMode === 'none'} disabled={busy} onClick={() => { setCautionMode('none'); onChange({ ...answers, cautions: [], cautionNote: undefined, safetyAnswered: true }); }} />
          <BigChoice label={t.cautions.some} selected={cautionMode === 'some'} disabled={busy} onClick={() => { setCautionMode('some'); onChange({ ...answers, safetyAnswered: answers.cautions.length > 0 ? true : false }); }} />
        </div>
        {cautionMode === 'some' && <div className="v9-chip-row" role="group" aria-label={legacy.cautions}>{parts.map(part => <ChoiceChip key={part} selected={answers.cautions.includes(part)} disabled={busy}
          onClick={() => { const next = answers.cautions.includes(part) ? answers.cautions.filter(value => value !== part) : [...answers.cautions, part]; onChange({ ...answers, cautions: next, safetyAnswered: next.length > 0 }); }}>{legacy.parts[part]}</ChoiceChip>)}</div>}
        {cautionMode === 'some' && answers.cautions.includes('other') && <label className="v9-field">
          <span>{t.cautions.otherLabel}</span>
          <input type="text" maxLength={TEXT_LIMITS.name} value={answers.cautionNote ?? ''} placeholder={t.cautions.otherPlaceholder} disabled={busy} aria-invalid={textIssue(answers.cautionNote, TEXT_LIMITS.name) ? true : undefined}
            onChange={event => onChange({ ...answers, cautionNote: event.target.value || undefined })} />
          <FieldIssue issue={textIssue(answers.cautionNote, TEXT_LIMITS.name)} locale={locale} max={TEXT_LIMITS.name} />
          <small>{t.cautions.otherHint}</small>
        </label>}
      </div>, <PrimaryButton disabled={busy || !(cautionMode === 'none' ? answers.cautions.length === 0 : cautionMode === 'some' && answers.cautions.length > 0 && (!answers.cautions.includes('other') || (!!answers.cautionNote?.trim() && !textIssue(answers.cautionNote, TEXT_LIMITS.name))))}
        onClick={() => { if (answers.safetyAnswered !== true) onChange({ ...answers, safetyAnswered: true }); go(1); }}>{t.next}</PrimaryButton>, t.cautions.sub);
    case screen.id === 'prefs': {
      const constraints = { noJump: false, quiet: false, space: 'small' as const, ...answers.constraints };
      return frame(t.prefs.title, <div className="v9-groups">
        <div className="v9-group"><span className="v9-group-label">{t.prefs.level}</span><div className="v9-chip-row" role="group" aria-label={t.prefs.level}>
          {(['beginner', 'intermediate'] as const).map(level => <ChoiceChip key={level} selected={(answers.level ?? 'beginner') === level} disabled={busy} onClick={() => engineChange({ ...answers, level })}>{t.prefs[level]}</ChoiceChip>)}</div></div>
        <div className="v9-group"><span className="v9-group-label">{t.prefs.limits}</span><div className="v9-chip-row" role="group" aria-label={t.prefs.limits}>
          {(['noJump', 'quiet'] as const).map(key => <ChoiceChip key={key} selected={constraints[key]} disabled={busy} onClick={() => engineChange({ ...answers, constraints: { ...constraints, [key]: !constraints[key] } })}>{t.prefs[key]}</ChoiceChip>)}</div></div>
        <div className="v9-group"><span className="v9-group-label">{t.prefs.space}</span><div className="v9-chip-row" role="group" aria-label={t.prefs.space}>
          {(['mat', 'small', 'medium', 'large'] as const).map((space, i) => <ChoiceChip key={space} selected={constraints.space === space} disabled={busy} onClick={() => engineChange({ ...answers, constraints: { noJump: false, quiet: false, ...answers.constraints, space } })}>{t.prefs.spaces[i]}</ChoiceChip>)}</div></div>
      </div>, nextButton(true), t.prefs.sub);
    }
    default: {
      const ready = complete && answers.adultConfirmed && answers.safetyAnswered !== false;
      // Never a grey button without a reason: list what is missing, each with a way back to it.
      const has = (id: string) => screens.some(row => row.id === id);
      const missing: { key: MissingKey; go: () => void }[] = ready ? [] : [
        ...(props.missingOuter ?? []).map(row => ({ key: row.key, go: () => props.onOuterStep?.(row.step) })),
        ...(!answers.adultConfirmed ? [{ key: 'adult' as const, go: () => setCurrent('intro') }] : []),
        ...(engineEnabled && !consent ? [{ key: 'consent' as const, go: () => setCurrent('intro') }] : []),
        ...(engine && !answers.birthYearMonth && has('birth') ? [{ key: 'birth' as const, go: () => setCurrent('birth') }] : []),
        ...(engine && answers.birthYearMonth && !answers.screening?.completedAt ? [{ key: 'screening' as const, go: () => setCurrent('group:parq') }] : []),
        ...(engine && !answers.population && has('population') ? [{ key: 'population' as const, go: () => setCurrent('population') }] : []),
        ...(answers.safetyAnswered === false ? [{ key: 'cautions' as const, go: () => setCurrent('cautions') }] : []),
      ];
      return frame(t.ready.title, <div className="v9-choices">
        {!ready && !busy && missing.length > 0 && <div className="v9-missing" role="status"><p>{pm.missingTitle}</p><ul>{missing.map(row => <li key={row.key}><span>{pm.missing[row.key]}</span>
          <PrimaryButton tone="text" size="sm" onClick={row.go}>{pm.fix}</PrimaryButton></li>)}</ul></div>}
        <div className="v9-onboarding-yaya"><Yaya pose="think" size={150} alt="" /></div>
        {mode === 'ai' && <details className="v9-consent"><summary>{legacy.consent}</summary><dl>{sendFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}
        {busy && <p role="status">{mode === 'ai' ? legacy.aiWorking : t.ready.working}</p>}
        {error && <p role="alert">{error}</p>}
      </div>, <>
        <PrimaryButton disabled={busy || !ready} onClick={() => { if (ready && !busy) onGenerate(); }}>{busy ? t.ready.working : t.ready.generate}</PrimaryButton>
        <PrimaryButton tone="text" size="md" disabled={busy} onClick={onManual}>{t.ready.manual}</PrimaryButton>
      </>, t.ready.sub);
    }
  }
}
