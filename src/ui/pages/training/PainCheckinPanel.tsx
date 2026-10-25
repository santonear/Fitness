import { useId, useState, type ReactNode } from 'react';
import type { Caution, PainSide } from '../../../engine/contracts';
import { painCheckinCopy } from '../../../i18n/features/training/pain-checkin';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { ChoiceChip, PainBodyPicker, PrimaryButton, SegmentedTabs, type PainSpot } from '../../components/kit';
import { lastFigureSex, setLastFigureSex } from '../plan-upgrade/prefs';

type Locale = 'zh' | 'en';
type Sex = 'male' | 'female';
export interface PainCheckinValue {
  painArea?: Caution;
  painSide?: PainSide;
  painScore?: number;
}
export interface RedFlagQuestion {
  key: string;
  label: string;
}

/** “右膝” / “Right knee”; “颈” and “腰背” have no side. */
export function painSpotLabel(locale: Locale, spot: PainSpot) {
  const t = painCheckinCopy[locale],
    name = t.spots[spot.area];
  return spot.side ? t.sides[spot.side].replace('{area}', locale === 'en' ? name.toLowerCase() : name) : name;
}
const spotOf = (value: PainCheckinValue): PainSpot | undefined =>
  value.painArea && value.painArea !== 'other'
    ? { area: value.painArea, ...(value.painSide ? { side: value.painSide } : {}) }
    : undefined;

function Progress({ total, done }: { total: number; done: number }) {
  return total > 1 ? (
    <div className="v9-pain-progress" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} data-done={index < done} />
      ))}
    </div>
  ) : null;
}

/** ③ Red-flag questions one per screen with big 是 / 否; answering moves to the next question. */
export function RedFlagSteps({
  locale,
  questions,
  answers,
  onAnswer,
  onBack,
  progress,
  disabled,
  children,
}: {
  locale: Locale;
  questions: readonly RedFlagQuestion[];
  answers: Record<string, boolean> | undefined;
  onAnswer: (key: string, answer: boolean | undefined) => void;
  /** 上一步 on the first question (back to the score). */
  onBack?: () => void;
  progress?: { total: number; done: number };
  disabled?: boolean;
  children?: ReactNode;
}) {
  const t = painCheckinCopy[locale],
    id = useId(),
    [index, setIndex] = useState(() => {
      const open = questions.findIndex(question => typeof answers?.[question.key] !== 'boolean');
      return open < 0 ? Math.max(0, questions.length - 1) : open;
    }),
    question = questions[Math.min(index, questions.length - 1)];
  if (!question) return null;
  const at = questions.indexOf(question);
  return (
    <fieldset className="v9-pain-panel" disabled={disabled} aria-labelledby={id}>
      {progress && <Progress {...progress} />}
      <p className="v9-pain-hint">
        {t.checks.replace('{n}', String(at + 1)).replace('{total}', String(questions.length))}
      </p>
      <p className="v9-pain-title" id={id}>
        {question.label}
      </p>
      <div className="v9-pain-yesno">
        {([true, false] as const).map(answer => (
          <ChoiceChip
            key={String(answer)}
            selected={answers?.[question.key] === answer}
            onClick={() => {
              const cleared = answers?.[question.key] === answer;
              onAnswer(question.key, cleared ? undefined : answer);
              if (!cleared && at < questions.length - 1) setIndex(at + 1);
            }}
          >
            {answer ? t.yes : t.no}
          </ChoiceChip>
        ))}
      </div>
      <p className="v9-pain-warn">{t.warn}</p>
      {children}
      {(at > 0 || onBack) && (
        <PrimaryButton tone="quiet" size="md" block onClick={() => (at > 0 ? setIndex(at - 1) : onBack?.())}>
          {t.previous}
        </PrimaryButton>
      )}
    </fieldset>
  );
}

/**
 * 人体图点疼痛 (UIUX20261008 I): ① tap where it hurts ② a 0–10 row ③ red-flag questions one per screen.
 * Shared by the pre-workout check, the in-workout 不舒服 entry and follow-ups. A partial answer stays a draft.
 */
export function PainCheckinPanel({
  locale,
  value,
  onChange,
  sex,
  questions = [],
  answers,
  onAnswer,
  areaLocked = false,
  disabled,
  finish,
}: {
  locale: Locale;
  value: PainCheckinValue;
  onChange: (value: PainCheckinValue) => void;
  /** From the profile; otherwise the last 男 / 女 toggle, then male. */
  sex?: Sex;
  questions?: readonly RedFlagQuestion[];
  answers?: Record<string, boolean>;
  onAnswer?: (key: string, answer: boolean | undefined) => void;
  /** The area is already known (a follow-up): start at the score. */
  areaLocked?: boolean;
  disabled?: boolean;
  /** Shown on the last screen when there are no questions (for example 记录). */
  finish?: ReactNode;
}) {
  const t = painCheckinCopy[locale],
    id = useId(),
    [step, setStep] = useState<'area' | 'score' | 'questions'>(areaLocked ? 'score' : 'area');
  const asked = questions.length > 0 && !!onAnswer,
    total = (areaLocked ? 0 : 1) + 1 + (asked ? 1 : 0),
    first = areaLocked ? 0 : 1,
    spot = spotOf(value);
  if (step === 'questions' && asked)
    return (
      <RedFlagSteps
        locale={locale}
        questions={questions}
        answers={answers}
        onAnswer={onAnswer}
        onBack={() => setStep('score')}
        progress={{ total, done: total }}
        disabled={disabled}
      />
    );
  if (step === 'score' || areaLocked) {
    const title = spot ? t.howMuch.replace('{spot}', painSpotLabel(locale, spot)) : t.howMuchOther;
    return (
      <fieldset className="v9-pain-panel" disabled={disabled} aria-labelledby={id}>
        <Progress total={total} done={first + 1} />
        <p className="v9-pain-title" id={id}>
          {title}
        </p>
        <p className="v9-pain-hint">{t.scaleHint}</p>
        <p className="v9-pain-score v9-num" aria-hidden="true">
          {value.painScore ?? '–'}
        </p>
        <div className="v9-pain-scale" role="radiogroup" aria-label={t.scaleLabel}>
          {Array.from({ length: 11 }, (_, score) => (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value.painScore === score}
              className="v9-num v8-press"
              onClick={() => onChange({ ...value, painScore: score })}
            >
              {score}
            </button>
          ))}
        </div>
        <div className="v9-pain-ends" aria-hidden="true">
          <span>{t.none}</span>
          <span>{t.worst}</span>
        </div>
        {asked ? (
          <PrimaryButton disabled={value.painScore === undefined} onClick={() => setStep('questions')}>
            {t.next}
          </PrimaryButton>
        ) : (
          finish
        )}
        {!areaLocked && (
          <PrimaryButton tone="quiet" size="md" block onClick={() => setStep('area')}>
            {t.previous}
          </PrimaryButton>
        )}
      </fieldset>
    );
  }
  return (
    <fieldset className="v9-pain-panel" disabled={disabled} aria-labelledby={id}>
      <Progress total={total} done={1} />
      <PainAreaPicker locale={locale} sex={sex} value={value} onChange={onChange} disabled={disabled} titleId={id} />
      <PrimaryButton disabled={!value.painArea} onClick={() => setStep('score')}>
        {t.next}
      </PrimaryButton>
    </fieldset>
  );
}

/** ① 哪里不舒服？: the figure (男 / 女 toggle at the top right) plus 别的地方 and 说不清, both stored as other. */
export function PainAreaPicker({
  locale,
  sex,
  value,
  onChange,
  disabled,
  titleId,
}: {
  locale: Locale;
  sex?: Sex;
  value: PainCheckinValue;
  onChange: (value: PainCheckinValue) => void;
  disabled?: boolean;
  titleId?: string;
}) {
  const t = painCheckinCopy[locale],
    p = planPagesCopy[locale],
    [figure, setFigure] = useState<Sex>(() => sex ?? lastFigureSex() ?? 'male'),
    [other, setOther] = useState<'elsewhere' | 'unsure'>(),
    spot = spotOf(value);
  const pick = (painArea: Caution, painSide?: PainSide) => {
    const next: PainCheckinValue = { ...value, painArea };
    if (painSide) next.painSide = painSide;
    else delete next.painSide;
    onChange(next);
  };
  return (
    <>
      <div className="v9-pain-head">
        <p className="v9-pain-title" id={titleId}>
          {t.where}
        </p>
        <SegmentedTabs
          label={p.sexLabel}
          value={figure}
          options={[
            { value: 'male', label: p.male },
            { value: 'female', label: p.female },
          ]}
          onChange={next => {
            const chosen = next === 'female' ? 'female' : 'male';
            setFigure(chosen);
            setLastFigureSex(chosen);
          }}
        />
      </div>
      <p className="v9-pain-hint">{t.tapHint}</p>
      <PainBodyPicker
        sex={figure}
        value={spot}
        onChange={next => {
          setOther(undefined);
          pick(next.area, next.side);
        }}
        label={t.figure[figure] + (spot ? t.marked.replace('{spot}', painSpotLabel(locale, spot)) : '')}
        spotLabel={next => painSpotLabel(locale, next)}
        viewLabels={{ front: t.front, back: t.backView }}
        disabled={disabled}
      />
      <div className="v9-pain-row">
        {(['elsewhere', 'unsure'] as const).map(kind => (
          <ChoiceChip
            key={kind}
            size="sm"
            selected={value.painArea === 'other' && (other ?? 'elsewhere') === kind}
            disabled={disabled}
            onClick={() => {
              setOther(kind);
              pick('other');
            }}
          >
            {t[kind]}
          </ChoiceChip>
        ))}
      </div>
    </>
  );
}
