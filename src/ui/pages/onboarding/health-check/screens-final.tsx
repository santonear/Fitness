import { TEXT_LIMITS, textIssue } from '../../../../domain/input-guard';
import { FieldIssue } from '../../../components/common/FieldIssue';
import { BigChoice, ChoiceChip, PrimaryButton, Yaya } from '../../../components/kit';
import { type MissingKey } from '../../../../i18n/features/onboarding/plan-mode';
import { parts } from './health-check-parts';
import type { HealthCheck } from './useHealthCheck';

/** Body areas to take care of. */
export function cautionsScreen(h: HealthCheck) {
  const { locale, answers, busy, onChange, t, legacy, cautionMode, setCautionMode, go, frame } = h;
  return frame(
    t.cautions.title,
    <div className="v9-choices">
      <div role="radiogroup" className="v9-choices">
        <BigChoice
          label={t.cautions.none}
          selected={cautionMode === 'none'}
          disabled={busy}
          onClick={() => {
            setCautionMode('none');
            onChange({ ...answers, cautions: [], cautionNote: undefined, safetyAnswered: true });
          }}
        />
        <BigChoice
          label={t.cautions.some}
          selected={cautionMode === 'some'}
          disabled={busy}
          onClick={() => {
            setCautionMode('some');
            onChange({ ...answers, safetyAnswered: answers.cautions.length > 0 ? true : false });
          }}
        />
      </div>
      {cautionMode === 'some' && (
        <div className="v9-chip-row" role="group" aria-label={legacy.cautions}>
          {parts.map(part => (
            <ChoiceChip
              key={part}
              selected={answers.cautions.includes(part)}
              disabled={busy}
              onClick={() => {
                const next = answers.cautions.includes(part)
                  ? answers.cautions.filter(value => value !== part)
                  : [...answers.cautions, part];
                onChange({ ...answers, cautions: next, safetyAnswered: next.length > 0 });
              }}
            >
              {legacy.parts[part]}
            </ChoiceChip>
          ))}
        </div>
      )}
      {cautionMode === 'some' && answers.cautions.includes('other') && (
        <label className="v9-field">
          <span>{t.cautions.otherLabel}</span>
          <input
            type="text"
            maxLength={TEXT_LIMITS.name}
            value={answers.cautionNote ?? ''}
            placeholder={t.cautions.otherPlaceholder}
            disabled={busy}
            aria-invalid={textIssue(answers.cautionNote, TEXT_LIMITS.name) ? true : undefined}
            onChange={event => onChange({ ...answers, cautionNote: event.target.value || undefined })}
          />
          <FieldIssue issue={textIssue(answers.cautionNote, TEXT_LIMITS.name)} locale={locale} max={TEXT_LIMITS.name} />
          <small>{t.cautions.otherHint}</small>
        </label>
      )}
    </div>,
    <PrimaryButton
      disabled={
        busy ||
        !(cautionMode === 'none'
          ? answers.cautions.length === 0
          : cautionMode === 'some' &&
            answers.cautions.length > 0 &&
            (!answers.cautions.includes('other') ||
              (!!answers.cautionNote?.trim() && !textIssue(answers.cautionNote, TEXT_LIMITS.name))))
      }
      onClick={() => {
        if (answers.safetyAnswered !== true) onChange({ ...answers, safetyAnswered: true });
        go(1);
      }}
    >
      {t.next}
    </PrimaryButton>,
    t.cautions.sub,
  );
}

/** Level, limits and space preferences. */
export function prefsScreen(h: HealthCheck) {
  const { answers, busy, t, engineChange, nextButton, frame } = h;
  const constraints = { noJump: false, quiet: false, space: 'small' as const, ...answers.constraints };
  return frame(
    t.prefs.title,
    <div className="v9-groups">
      <div className="v9-group">
        <span className="v9-group-label">{t.prefs.level}</span>
        <div className="v9-chip-row" role="group" aria-label={t.prefs.level}>
          {(['beginner', 'intermediate'] as const).map(level => (
            <ChoiceChip
              key={level}
              selected={(answers.level ?? 'beginner') === level}
              disabled={busy}
              onClick={() => engineChange({ ...answers, level })}
            >
              {t.prefs[level]}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="v9-group">
        <span className="v9-group-label">{t.prefs.limits}</span>
        <div className="v9-chip-row" role="group" aria-label={t.prefs.limits}>
          {(['noJump', 'quiet'] as const).map(key => (
            <ChoiceChip
              key={key}
              selected={constraints[key]}
              disabled={busy}
              onClick={() => engineChange({ ...answers, constraints: { ...constraints, [key]: !constraints[key] } })}
            >
              {t.prefs[key]}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="v9-group">
        <span className="v9-group-label">{t.prefs.space}</span>
        <div className="v9-chip-row" role="group" aria-label={t.prefs.space}>
          {(['mat', 'small', 'medium', 'large'] as const).map((space, i) => (
            <ChoiceChip
              key={space}
              selected={constraints.space === space}
              disabled={busy}
              onClick={() =>
                engineChange({
                  ...answers,
                  constraints: { noJump: false, quiet: false, ...answers.constraints, space },
                })
              }
            >
              {t.prefs.spaces[i]}
            </ChoiceChip>
          ))}
        </div>
      </div>
    </div>,
    nextButton(true),
    t.prefs.sub,
  );
}

/** The last screen: what is missing, what is sent, and 生成计划. */
export function readyScreen(h: HealthCheck) {
  const {
    props,
    answers,
    engineEnabled,
    mode,
    busy,
    error,
    complete,
    sendFields,
    onGenerate,
    onManual,
    t,
    legacy,
    consent,
    engine,
    setCurrent,
    screens,
    frame,
    pm,
  } = h;
  const ready = complete && answers.adultConfirmed && answers.safetyAnswered !== false;
  // Never a grey button without a reason: list what is missing, each with a way back to it.
  const has = (id: string) => screens.some(row => row.id === id);
  const missing: { key: MissingKey; go: () => void }[] = ready
    ? []
    : [
        ...(props.missingOuter ?? []).map(row => ({ key: row.key, go: () => props.onOuterStep?.(row.step) })),
        ...(!answers.adultConfirmed ? [{ key: 'adult' as const, go: () => setCurrent('intro') }] : []),
        ...(engineEnabled && !consent ? [{ key: 'consent' as const, go: () => setCurrent('intro') }] : []),
        ...(engine && !answers.birthYearMonth && has('birth')
          ? [{ key: 'birth' as const, go: () => setCurrent('birth') }]
          : []),
        ...(engine && answers.birthYearMonth && !answers.screening?.completedAt
          ? [{ key: 'screening' as const, go: () => setCurrent('group:parq') }]
          : []),
        ...(engine && !answers.population && has('population')
          ? [{ key: 'population' as const, go: () => setCurrent('population') }]
          : []),
        ...(answers.safetyAnswered === false ? [{ key: 'cautions' as const, go: () => setCurrent('cautions') }] : []),
      ];
  return frame(
    t.ready.title,
    <div className="v9-choices">
      {!ready && !busy && missing.length > 0 && (
        <div className="v9-missing" role="status">
          <p>{pm.missingTitle}</p>
          <ul>
            {missing.map(row => (
              <li key={row.key}>
                <span>{pm.missing[row.key]}</span>
                <PrimaryButton tone="text" size="sm" onClick={row.go}>
                  {pm.fix}
                </PrimaryButton>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="v9-onboarding-yaya">
        <Yaya pose="think" size={150} alt="" />
      </div>
      {mode === 'ai' && (
        <details className="v9-consent">
          <summary>{legacy.consent}</summary>
          <dl>
            {sendFields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {busy && <p role="status">{mode === 'ai' ? legacy.aiWorking : t.ready.working}</p>}
      {error && <p role="alert">{error}</p>}
    </div>,
    <>
      <PrimaryButton
        disabled={busy || !ready}
        onClick={() => {
          if (ready && !busy) onGenerate();
        }}
      >
        {busy ? t.ready.working : t.ready.generate}
      </PrimaryButton>
      <PrimaryButton tone="text" size="md" disabled={busy} onClick={onManual}>
        {t.ready.manual}
      </PrimaryButton>
    </>,
    t.ready.sub,
  );
}
