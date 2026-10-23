import type { EngineProfile } from '../../../../engine/contracts';
import { engineCopy } from '../../../../coach/engine-copy';
import { BigChoice, PrimaryButton, Card } from '../../../components/kit';
import type { HealthCheck } from './useHealthCheck';

/** Adult confirmation and local health-data consent. */
export function introScreen(h: HealthCheck) {
  const {
    locale,
    answers,
    engineEnabled,
    busy,
    onChange,
    onManual,
    t,
    engineChange,
    consent,
    minor,
    engine,
    male,
    choosePopulation,
    go,
    frame,
  } = h;
  const ready = answers.adultConfirmed && (!engineEnabled || consent);
  return frame(
    t.intro.title,
    <div className="v9-choices">
      {engineEnabled && <p className="v9-onboarding-note">{engineCopy('safety.copy.disclaimer', locale)}</p>}
      <BigChoice
        kind="check"
        label={t.intro.adult}
        selected={answers.adultConfirmed}
        disabled={busy || minor}
        onClick={() => onChange({ ...answers, adultConfirmed: !answers.adultConfirmed })}
      />
      {engineEnabled && (
        <BigChoice
          kind="check"
          label={engineCopy('safety.copy.local_health_consent', locale)}
          selected={consent}
          disabled={busy}
          onClick={() =>
            engineChange(consent ? {} : { ...answers, healthStorageConsent: { acceptedAt: new Date().toISOString() } })
          }
        />
      )}
      {(minor || !answers.adultConfirmed) && <p className="v9-onboarding-note">{t.intro.minor}</p>}
    </div>,
    <>
      <PrimaryButton
        disabled={busy || !ready}
        onClick={() => {
          // A man is never asked about pregnancy; record the same answer the selector would ("neither").
          if (engine && male && !answers.population) choosePopulation('general');
          go(1);
        }}
      >
        {t.next}
      </PrimaryButton>
      <PrimaryButton tone="text" size="md" disabled={busy} onClick={onManual}>
        {t.ready.manual}
      </PrimaryButton>
    </>,
  );
}

/** A question group summary: 都没有 skips it, 有 opens its questions. */
export function groupScreen(h: HealthCheck) {
  const { busy, t, expanded, setExpanded, groups, allNo, screen, go, answerThen, answered, frame, groupCopy } = h;
  const name = screen.group!,
    items = groups[name],
    open = expanded.has(name),
    copy = groupCopy[name];
  return frame(
    copy.title,
    <>
      <Card variant="inset" padding="md" as="section">
        <ul className="v9-check-list">
          {items.map(item => (
            <li key={item.key} data-answer={item.value === undefined ? 'unknown' : item.value ? 'yes' : 'no'}>
              {item.text}
            </li>
          ))}
        </ul>
      </Card>
    </>,
    <>
      <PrimaryButton
        disabled={busy}
        onClick={() =>
          answerThen(() => {
            allNo[name]();
            setExpanded(previous => {
              const next = new Set(previous);
              next.delete(name);
              return next;
            });
          })
        }
      >
        {t.none}
      </PrimaryButton>
      {open && answered(name) ? (
        <PrimaryButton tone="quiet" disabled={busy} onClick={() => go(1)}>
          {t.next}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          tone="quiet"
          disabled={busy}
          onClick={() => answerThen(() => setExpanded(previous => new Set(previous).add(name)))}
        >
          {t.some}
        </PrimaryButton>
      )}
    </>,
    copy.sub,
  );
}

/** Resting blood pressure. */
export function bpScreen(h: HealthCheck) {
  const { busy, t, d, answerThen, nextButton, frame } = h;
  return frame(
    t.bp.title,
    <div className="v9-choices" role="radiogroup">
      {(
        [
          ['known_below_threshold', t.bp.low],
          ['ge_160_90', t.bp.high],
          ['unknown', t.bp.unknown],
        ] as const
      ).map(([value, label]) => (
        <BigChoice
          key={value}
          label={label}
          selected={d.extra.restingBp === value}
          disabled={busy}
          onClick={() =>
            answerThen(() =>
              d.update(d.answers, { ...d.extra, restingBp: value as EngineProfile['screening']['restingBp'] }),
            )
          }
        />
      ))}
    </div>,
    d.extra.restingBp ? nextButton(true) : undefined,
    t.bp.sub,
  );
}

/** Pregnant / postpartum / neither. */
export function populationScreen(h: HealthCheck) {
  const { busy, t, kind, choosePopulation, answerThen, nextButton, frame } = h;
  const selected = kind === 'older_adult' ? 'general' : kind;
  return frame(
    t.population.title,
    <div className="v9-choices" role="radiogroup">
      {(['general', 'pregnant', 'postpartum'] as const).map(value => (
        <BigChoice
          key={value}
          label={t.population[value]}
          selected={selected === value}
          disabled={busy}
          onClick={() =>
            answerThen(() => {
              if (selected !== value) choosePopulation(value);
            })
          }
        />
      ))}
    </div>,
    selected ? nextButton(true) : undefined,
    t.population.sub,
  );
}

/** Pregnancy or postpartum week stepper. */
export function weekScreen(h: HealthCheck) {
  const { busy, t, d, screen, nextButton, frame } = h;
  const weeks = d.populationDraft.weeks;
  const limit = screen.id === 'preg:week' ? 42 : 104;
  const set = (value: number | undefined) =>
    d.updatePopulation({
      ...d.populationDraft,
      weeks:
        value === undefined || !Number.isFinite(value) ? undefined : Math.min(limit, Math.max(0, Math.round(value))),
    });
  return frame(
    screen.id === 'preg:week' ? t.pregnancyWeek : t.postpartumWeek,
    <div className="v9-stepper">
      <button
        type="button"
        className="v9-round v8-press"
        aria-label={t.fewer}
        disabled={busy || !weeks}
        onClick={() => set(Math.max(0, (weeks ?? 1) - 1))}
      >
        −
      </button>
      <input
        className="v9-num"
        type="number"
        min="0"
        max={limit}
        step="1"
        inputMode="numeric"
        aria-label={screen.id === 'preg:week' ? t.pregnancyWeek : t.postpartumWeek}
        value={weeks ?? ''}
        disabled={busy}
        onChange={event => set(event.target.value === '' ? undefined : Number(event.target.value))}
      />
      <button
        type="button"
        className="v9-round v8-press"
        aria-label={t.more}
        disabled={busy || (weeks ?? 0) >= limit}
        onClick={() => set((weeks ?? 0) + 1)}
      >
        +
      </button>
    </div>,
    nextButton(weeks !== undefined),
  );
}

/** Postpartum delivery type. */
export function deliveryScreen(h: HealthCheck) {
  const { busy, t, d, answerThen, nextButton, frame } = h;
  return frame(
    t.delivery.title,
    <div className="v9-choices" role="radiogroup">
      {(
        [
          ['vaginal', t.delivery.vaginal],
          ['assisted_or_tear', t.delivery.assisted],
          ['cesarean', t.delivery.cesarean],
        ] as const
      ).map(([value, label]) => (
        <BigChoice
          key={value}
          label={label}
          selected={d.populationDraft.delivery === value}
          disabled={busy}
          onClick={() => answerThen(() => d.updatePopulation({ ...d.populationDraft, delivery: value }))}
        />
      ))}
    </div>,
    d.populationDraft.delivery ? nextButton(true) : undefined,
  );
}

/** Vigorous-exercise advisory at 45 and over. */
export function age45Screen(h: HealthCheck) {
  const { locale, answers, busy, t, engineChange, d, nextButton, frame } = h;
  const screen45 = d.screen!,
    acknowledged = screen45.age45AdvisoryAck?.screenedAt === screen45.completedAt;
  return frame(
    t.age45.title,
    <div className="v9-choices">
      <p className="v9-onboarding-note">{engineCopy('safety.copy.age45_advisory', locale)}</p>
      <BigChoice
        kind="check"
        label={t.age45.ack}
        selected={acknowledged}
        disabled={busy}
        onClick={() =>
          engineChange({
            ...answers,
            screening: {
              ...screen45,
              age45AdvisoryAck: acknowledged
                ? undefined
                : { acknowledgedAt: new Date().toISOString(), screenedAt: screen45.completedAt! },
            },
          })
        }
      />
    </div>,
    nextButton(true),
  );
}
