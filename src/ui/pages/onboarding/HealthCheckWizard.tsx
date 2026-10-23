import { engineCopy } from '../../../coach/engine-copy';
import { fill } from '../../../i18n/features/onboarding/entry';
import { BigChoice, Card } from '../../components/kit';
import { BirthMonthField } from '../../components/BirthMonthField';
import { PlanModeChoice } from './PlanModeChoice';
import { type HealthCheckWizardProps, YesNo } from './health-check/health-check-parts';
import { useHealthCheck } from './health-check/useHealthCheck';
import {
  introScreen,
  groupScreen,
  bpScreen,
  populationScreen,
  weekScreen,
  deliveryScreen,
  age45Screen,
} from './health-check/screens-questions';
import { cautionsScreen, prefsScreen, readyScreen } from './health-check/screens-final';

/**
 * The health self-check, one question per screen. It reuses the settings editor's draft hook, so every
 * answer is written to exactly the same fields with the same completeness rules; only presentation differs.
 */
export function HealthCheckWizard(props: HealthCheckWizardProps) {
  const h = useHealthCheck(props);
  const {
    locale,
    answers,
    engineEnabled,
    busy,
    onChange,
    t,
    engineChange,
    d,
    screen,
    answerThen,
    nextButton,
    frame,
    pm,
    ai,
  } = h;
  switch (true) {
    case screen.id === 'planMode': {
      const canGo = answers.planMode === 'local' || (answers.planMode === 'ai' && ai.readiness === 'active');
      return frame(
        pm.title,
        <PlanModeChoice
          locale={locale}
          value={answers.planMode}
          busy={busy}
          engineEnabled={engineEnabled}
          readiness={ai.readiness}
          onRefresh={ai.refresh}
          onChange={planMode => onChange({ ...answers, planMode })}
        />,
        nextButton(canGo),
        pm.sub,
      );
    }
    case screen.id === 'intro':
      return introScreen(h);
    case screen.id === 'birth':
      return frame(
        t.birth.title,
        <div className="v9-field" role="group" aria-label={t.birth.label}>
          <BirthMonthField
            locale={locale}
            value={answers.birthYearMonth}
            disabled={busy}
            onChange={birthYearMonth => engineChange({ ...answers, birthYearMonth })}
          />
        </div>,
        nextButton(!!answers.birthYearMonth),
        t.birth.sub,
      );
    case screen.id.startsWith('group:'):
      return groupScreen(h);
    case screen.id.startsWith('q:'): {
      const item = screen.item!;
      return frame(
        item.text,
        <YesNo
          value={item.value}
          yes={t.yes}
          no={t.no}
          disabled={busy}
          onAnswer={answer => answerThen(() => item.set(answer))}
        />,
        typeof item.value === 'boolean' ? nextButton(true) : undefined,
        undefined,
        fill(t.question, { index: (screen.index ?? 0) + 1, total: screen.total ?? 1 }),
      );
    }
    case screen.id === 'activity':
      return frame(
        t.activity.title,
        <div className="v9-choices" role="radiogroup">
          {(['active', 'inactive'] as const).map(value => (
            <BigChoice
              key={value}
              label={value === 'active' ? t.activity.yes : t.activity.no}
              selected={d.extra.activityStatus === value}
              disabled={busy}
              onClick={() => answerThen(() => d.update(d.answers, { ...d.extra, activityStatus: value }))}
            />
          ))}
        </div>,
        d.extra.activityStatus ? nextButton(true) : undefined,
        t.activity.sub,
      );
    case screen.id === 'bp':
      return bpScreen(h);
    case screen.id === 'population':
      return populationScreen(h);
    case screen.id === 'preg:week' || screen.id === 'pp:week':
      return weekScreen(h);
    case screen.id === 'preg:prenatal':
      return frame(
        engineCopy('pregnancy.gate.copy.prenatal_checkups_question', locale),
        <>
          <YesNo
            value={d.pregnancyDraft.prenatalCareConfirmed}
            yes={t.yes}
            no={t.no}
            disabled={busy}
            onAnswer={answer => answerThen(() => d.changePregnancy({ type: 'prenatal', answer }))}
          />
          {d.pregnancyDraft.prenatalCareConfirmed === false && (
            <p className="v9-onboarding-note">{engineCopy('pregnancy.gate.copy.ask_provider', locale)}</p>
          )}
        </>,
        d.pregnancyDraft.prenatalCareConfirmed !== undefined ? nextButton(true) : undefined,
      );
    case screen.id === 'preg:provider': {
      const value = d.populationDraft.provider !== undefined ? !d.populationDraft.provider : undefined;
      return frame(
        engineCopy('pregnancy.gate.copy.provider_question', locale),
        <YesNo
          value={value}
          yes={t.yes}
          no={t.no}
          disabled={busy}
          onAnswer={answer => answerThen(() => d.updatePopulation({ ...d.populationDraft, provider: !answer }))}
        />,
        value !== undefined ? nextButton(true) : undefined,
      );
    }
    case screen.id === 'preg:info':
      return frame(
        t.pregnancyInfo,
        <Card variant="inset" padding="md" as="section" className="v9-onboarding-notes">
          <p>{engineCopy('pregnancy.gate.copy.app_limit', locale)}</p>
          <p>{engineCopy('pregnancy.environment.copy.heat', locale)}</p>
          <p>{engineCopy('pregnancy.environment.copy.altitude', locale)}</p>
        </Card>,
        nextButton(true),
      );
    case screen.id === 'pp:provider':
      return frame(
        t.postpartumProvider,
        <YesNo
          value={d.populationDraft.provider}
          yes={t.yes}
          no={t.no}
          disabled={busy}
          onAnswer={answer => answerThen(() => d.updatePopulation({ ...d.populationDraft, provider: answer }))}
        />,
        d.populationDraft.provider !== undefined ? nextButton(true) : undefined,
      );
    case screen.id === 'pp:delivery':
      return deliveryScreen(h);
    case screen.id === 'age45':
      return age45Screen(h);
    case screen.id === 'cautions':
      return cautionsScreen(h);
    case screen.id === 'prefs':
      return prefsScreen(h);
    default:
      return readyScreen(h);
  }
}
