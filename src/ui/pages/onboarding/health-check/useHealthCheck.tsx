import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createPregnancyReconfirmationDraft,
  pregnancyPopulationFromDraft,
} from '../../../../application/pregnancy-safety';
import { painQuestionKeys } from '../../../../application/pain-events';
import type { EngineProfileFields } from '../../../../application/engine-profile';
import { engineCopy } from '../../../../coach/engine-copy';
import { entryCopy } from '../../../../i18n/features/onboarding/entry';
import zhCopy from '../../../../i18n/features/onboarding/zh.json';
import enCopy from '../../../../i18n/features/onboarding/en.json';
import { PrimaryButton } from '../../../components/kit';
import { useEngineProfileDraft, engineFallKeys, engineOlderAge } from '../../settings/EngineProfileEditor';
import { OnboardingFrame } from '../OnboardingFrame';
import { useAiReadiness } from '../PlanModeChoice';
import { planModeCopy } from '../../../../i18n/features/onboarding/plan-mode';
import { cmrKeys, age45, type Group, type Item, type Screen, type HealthCheckWizardProps } from './health-check-parts';

/** State and answer helpers of the health self-check; the wizard renders one screen from them. */
export function useHealthCheck(props: HealthCheckWizardProps) {
  const {
    locale,
    answers,
    engineEnabled,
    bodyEnabled,
    mode,
    busy,
    error,
    step,
    total,
    complete,
    sendFields,
    onChange,
    onExit,
    onGenerate,
    onManual,
  } = props;
  const t = entryCopy[locale],
    legacy = locale === 'zh' ? zhCopy : enCopy;
  const engineChange = (fields: EngineProfileFields) =>
    onChange({
      ...answers,
      ...fields,
      ...(!fields.healthStorageConsent
        ? {
            healthStorageConsent: undefined,
            screening: undefined,
            population: undefined,
            birthYearMonth: undefined,
            painState: undefined,
            powerOneRm: undefined,
            postpartumRisk: undefined,
          }
        : {}),
    });
  const d = useEngineProfileDraft({ value: answers, onChange: engineChange, locale, ageYears: answers.body?.age });
  const requiredAt = useRef(new Date().toISOString());
  const consent = !!answers.healthStorageConsent,
    minor = bodyEnabled && answers.body?.age !== undefined && answers.body.age < 18;
  const engine = engineEnabled && consent;
  const male = answers.body?.biologicalSex === '男性';
  const kind = d.populationKind;
  const [expanded, setExpanded] = useState<Set<Group>>(
    () =>
      new Set<Group>([
        ...(d.answers.some(value => value === true) ? ['parq' as const] : []),
        ...(Object.values(d.cmrAnswers).some(Boolean) ? ['cmr' as const] : []),
        ...(d.extra.knownCondition || d.extra.acuteIllness ? ['other' as const] : []),
      ]),
  );
  const [cautionMode, setCautionMode] = useState<'none' | 'some' | undefined>(
    answers.cautions.length ? 'some' : answers.safetyAnswered ? 'none' : undefined,
  );
  const [current, setCurrent] = useState(props.initialScreen ?? 'intro');
  const [advance, setAdvance] = useState<{ from: string; nonce: number }>();

  const screening = answers.screening;
  const redAreas = answers.cautions.filter(area => area !== 'other');
  const redKeys = redAreas.length ? painQuestionKeys(redAreas) : [];
  const setRedflag = (next: Record<string, boolean>) => {
    if (!screening) return;
    const prior = screening.redFlagReview;
    onChange({
      ...answers,
      screening: {
        ...screening,
        redFlagReview: {
          requiredAt: prior?.requiredAt ?? requiredAt.current,
          areas: redAreas,
          questionKeys: redKeys,
          answers: next,
          ...(redKeys.every(key => typeof next[key] === 'boolean') ? { answeredAt: new Date().toISOString() } : {}),
        },
      },
    });
  };
  function choosePopulation(next: string) {
    d.setPopulationKind(next);
    d.setPopulationDraft({});
    d.setPregnancyDraft(createPregnancyReconfirmationDraft());
    d.setFallsAnswers(Array.from({ length: engineFallKeys.length }, () => undefined));
    engineChange({
      ...answers,
      population:
        next === 'pregnant'
          ? pregnancyPopulationFromDraft(createPregnancyReconfirmationDraft())
          : next === 'general'
            ? { kind: 'general' }
            : next === 'older_adult'
              ? { kind: 'older_adult' }
              : undefined,
    });
  }
  function setFalls(next: (boolean | undefined)[]) {
    d.setFallsAnswers(next);
    d.setPopulationKind('older_adult');
    const prior = answers.population?.kind === 'older_adult' ? answers.population : { kind: 'older_adult' as const };
    const known = next.every(value => typeof value === 'boolean');
    engineChange({
      ...answers,
      population: {
        ...prior,
        fallsAnswers: known ? (next as boolean[]) : undefined,
        walkingAid: next[3],
        balanceCautious: next.some(value => value === true) ? true : known ? false : undefined,
      },
    });
  }

  const groups: Record<Group, Item[]> = {
    parq: d.answers.map((value, index) => ({
      key: `parq:${index}`,
      text: engineCopy(`safety.copy.parq_${index + 1}`, locale),
      value,
      set: answer => {
        const next = [...d.answers];
        next[index] = answer;
        d.update(next);
      },
    })),
    cmr: cmrKeys.map(key => ({
      key: `cmr:${key}`,
      text: engineCopy(`safety.copy.cmr_${key}`, locale),
      value: d.cmrAnswers[key],
      set: answer => d.update(d.answers, d.extra, { ...d.cmrAnswers, [key]: answer }),
    })),
    other: [
      {
        key: 'other:known',
        text: t.other.known,
        value: d.extra.knownCondition,
        set: answer => d.update(d.answers, { ...d.extra, knownCondition: answer }),
      },
      {
        key: 'other:acute',
        text: t.other.acute,
        value: d.extra.acuteIllness,
        set: answer => d.update(d.answers, { ...d.extra, acuteIllness: answer }),
      },
    ],
    preg: [...d.absoluteList, ...d.relativeList].map(row => ({
      key: `preg:${row.key}`,
      text: row.text,
      value: d.contraindicationAnswers[row.key],
      set: answer => d.changePregnancy({ type: 'contraindication', key: row.key, answer }),
    })),
    falls: engineFallKeys.map((key, index) => ({
      key: `falls:${key}`,
      text: engineCopy(`older.screen.copy.${key}`, locale),
      value: d.fallsAnswers[index],
      set: answer => {
        const next = [...d.fallsAnswers];
        next[index] = answer;
        setFalls(next);
      },
    })),
    redflag: redKeys.map(key => ({
      key: `redflag:${key}`,
      text: engineCopy(`redflag.copy.question_${key}`, locale),
      value: screening?.redFlagReview?.answers?.[key],
      set: answer => setRedflag({ ...screening?.redFlagReview?.answers, [key]: answer }),
    })),
  };
  const allNo: Record<Group, () => void> = {
    parq: () => d.update(d.answers.map(() => false)),
    cmr: () => d.update(d.answers, d.extra, Object.fromEntries(cmrKeys.map(key => [key, false]))),
    other: () => d.update(d.answers, { ...d.extra, knownCondition: false, acuteIllness: false }),
    preg: () =>
      d.changePregnancyAll(
        [...d.absoluteList, ...d.relativeList].map(row => ({
          type: 'contraindication' as const,
          key: row.key,
          answer: false,
        })),
      ),
    falls: () => setFalls(engineFallKeys.map(() => false)),
    redflag: () => setRedflag(Object.fromEntries(redKeys.map(key => [key, false]))),
  };

  const age = d.currentAge;
  const showFalls =
    engine && (kind === 'general' || kind === 'older_adult') && age !== undefined && age >= engineOlderAge;
  const screens = (() => {
    const list: Screen[] = [{ id: 'intro' }];
    const group = (name: Group) => {
      list.push({ id: `group:${name}`, group: name });
      if (expanded.has(name))
        groups[name].forEach((item, index, all) =>
          list.push({ id: `q:${item.key}`, group: name, item, index, total: all.length }),
        );
    };
    if (engine) {
      list.push({ id: 'birth' });
      group('parq');
      group('cmr');
      group('other');
      list.push({ id: 'activity' }, { id: 'bp' });
      if (!male || (kind !== 'general' && kind !== 'older_adult')) list.push({ id: 'population' });
      if (kind === 'pregnant') {
        list.push({ id: 'preg:week' }, { id: 'preg:prenatal' }, { id: 'preg:provider' });
        group('preg');
        list.push({ id: 'preg:info' });
      }
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
  const lastIndex = useRef(0),
    found = screens.findIndex(screen => screen.id === current);
  const index = found >= 0 ? found : Math.min(lastIndex.current, screens.length - 1);
  lastIndex.current = index;
  const screen = screens[index] ?? screens[0];
  const go = (offset: number) => {
    const next = index + offset;
    if (next < 0) onExit();
    else setCurrent(screens[Math.min(screens.length - 1, next)].id);
  };
  // Answers change the screen list (e.g. 在孕期 adds follow-ups); advance after the list is rebuilt.
  useEffect(() => {
    if (advance && advance.from === screen.id) go(1);
  }, [advance]);
  const answerThen = (apply: () => void) => {
    apply();
    setAdvance({ from: screen.id, nonce: Date.now() });
  };

  const answered = (name: Group) => groups[name].every(item => typeof item.value === 'boolean');
  const nextButton = (enabled: boolean, label: string = t.next) => (
    <PrimaryButton disabled={busy || !enabled} onClick={() => go(1)}>
      {label}
    </PrimaryButton>
  );
  const frame = (title: ReactNode, body: ReactNode, footer?: ReactNode, sub?: ReactNode, counter?: string) => (
    <OnboardingFrame
      locale={locale}
      step={step}
      total={total}
      within={(index + 1) / screens.length}
      screenKey={screen.id}
      title={title}
      sub={sub}
      counter={counter}
      onBack={() => go(-1)}
      backDisabled={busy}
      onHome={props.onHome}
      footer={footer}
      busy={busy}
    >
      {body}
    </OnboardingFrame>
  );
  const groupCopy: Record<Group, { title: string; sub?: string }> = {
    parq: t.parq,
    cmr: t.cmr,
    other: { title: t.other.title },
    preg: { title: t.pregnancyList, sub: engineCopy('pregnancy.gate.copy.intro', locale) },
    falls: { title: engineCopy('older.screen.copy.intro', locale) },
    redflag: t.redflag,
  };

  const pm = planModeCopy[locale];
  const ai = useAiReadiness(!!props.aiAvailable && answers.planMode === 'ai');
  return {
    props,
    locale,
    answers,
    engineEnabled,
    bodyEnabled,
    mode,
    busy,
    error,
    step,
    total,
    complete,
    sendFields,
    onChange,
    onExit,
    onGenerate,
    onManual,
    t,
    legacy,
    engineChange,
    d,
    requiredAt,
    consent,
    minor,
    engine,
    male,
    kind,
    expanded,
    setExpanded,
    cautionMode,
    setCautionMode,
    current,
    setCurrent,
    advance,
    setAdvance,
    screening,
    redAreas,
    redKeys,
    setRedflag,
    choosePopulation,
    setFalls,
    groups,
    allNo,
    age,
    showFalls,
    screens,
    lastIndex,
    found,
    index,
    screen,
    go,
    answerThen,
    answered,
    nextButton,
    frame,
    groupCopy,
    pm,
    ai,
  };
}
export type HealthCheck = ReturnType<typeof useHealthCheck>;
