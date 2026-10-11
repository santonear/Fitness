import {templateLabel} from '../../../i18n/features/plan/labels';
import type { PlannedItem, PlanVersion } from '../../../domain/v8/contracts';
import { planMessages, type PlanLanguage } from '../../../i18n/features/plan/messages';
import { Button, Chip, Row, Sheet } from '../../components/common';
import './plan.css';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';

export interface PlanPageProps {
  version: PlanVersion;
  /** Supplied by the host from its selected plan; never inferred from version numbers. */
  currentVersionId: string;
  language: PlanLanguage;
  exerciseName: (exerciseId: string) => string;
  onVersions: () => void;
  onExercises: () => void;
  /** Opens read-only details; any proposed edits require the host's separate confirmation flow. */
  onExercise: (version: PlanVersion, templateId: string, itemIndex: number, trigger?: HTMLElement) => void;
  onDiscuss?: (version: PlanVersion) => void;
}

export function itemTarget(item: PlannedItem, language: PlanLanguage): string {
  const t = planMessages[language], target = item.target;
  const value = target.metricType === 'reps_load' ? `${t.reps(target.reps)} · ${target.loadGrams>0?t.kg(target.loadGrams / 1000):(language==='zh'?guideZh:guideEn).chooseLoad}`
    : target.metricType === 'reps' ? t.reps(target.reps)
    : target.metricType === 'duration' ? t.seconds(target.durationSeconds)
    : `${t.seconds(target.durationSeconds)}${target.distanceMeters === undefined ? '' : ` · ${t.meters(target.distanceMeters)}`}`;
  return `${t.sets(item.sets)} · ${value}`;
}

export {templateLabel} from '../../../i18n/features/plan/labels';
export function PlanPage({ version, currentVersionId, language, exerciseName, onVersions, onExercises, onExercise, onDiscuss }: PlanPageProps) {
  const t = planMessages[language], current = version.id === currentVersionId;
  const sourceCopy=language==='zh'?guideZh:guideEn;
  const source=[t.origins[version.origin],version.source==='local'?sourceCopy.basic:version.source==='ai'?sourceCopy.ai:''].filter(Boolean).join(' · ');
  return <section className="plan-page" aria-labelledby="plan-title">
    <header><h1 id="plan-title">{t.title}</h1>
      <p className="plan-muted">{t.version(version.versionNumber)} · <time dateTime={version.createdAt}>{new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(version.createdAt))}</time> · {source}{!current && ` · ${t.readOnly}`}</p>
    </header>
    <div className="plan-overview"><Sheet><dl className="plan-summary"><dt>{t.goal}</dt><dd>{version.goalText}</dd></dl></Sheet><Sheet><dl className="plan-summary"><dt>{t.rhythm}</dt><dd>{t.pace(version.weeklyTarget)}</dd><dd className="plan-muted">{t.minutes(Math.min(...version.templates.map(x=>x.estimatedMinutes)))}{Math.max(...version.templates.map(x=>x.estimatedMinutes))!==Math.min(...version.templates.map(x=>x.estimatedMinutes))?` – ${t.minutes(Math.max(...version.templates.map(x=>x.estimatedMinutes)))}`:''}</dd></dl></Sheet></div>
    {version.scheduleOriginalText.trim() && <p className="plan-muted">{version.scheduleOriginalText}</p>}
    {version.templates.map(template => <section className="plan-session" key={template.id} aria-label={templateLabel(template, language)}>
      <Row><h2>{templateLabel(template, language)}</h2><span className="plan-muted">{t.minutes(template.estimatedMinutes)}</span></Row>
      <div className="plan-items">{template.items.map((item, index) => <Chip key={`${item.exerciseId}-${index}`} selected={false}
        onClick={event => onExercise(version, template.id, index, event.currentTarget)}>{exerciseName(item.exerciseId)} · {itemTarget(item, language)}</Chip>)}</div>
    </section>)}
    <nav className="plan-actions" aria-label={t.title}><Button onClick={onVersions}>{t.history}</Button><Button onClick={onExercises}>{t.library}</Button></nav>
    {current && onDiscuss && <Button variant="primary" onClick={() => { if (version.id === currentVersionId) onDiscuss(version); }}>{t.chat}</Button>}
  </section>;
}
