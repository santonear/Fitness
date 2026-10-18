import {templateLabel,estimatedDurationLabel} from '../../../i18n/features/plan/labels';
import type { PlannedItem, PlanVersion } from '../../../domain/v8/contracts';
import { planMessages, type PlanLanguage } from '../../../i18n/features/plan/messages';
import { Button, Chip, Row, Sheet } from '../../components/common';
import './plan.css';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
import {EXERCISE_IDS} from '../../../catalog/exercise-ids';
import {durationText} from '../../components/ExerciseTargets';

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

export function itemTarget(item: PlannedItem, language: PlanLanguage, hideDistance = false): string {
  const t = planMessages[language], target = item.target;
  const value = target.metricType === 'reps_load' ? `${t.reps(target.reps)} · ${target.loadGrams>0?t.kg(target.loadGrams / 1000):(language==='zh'?guideZh:guideEn).chooseLoad}`
    : target.metricType === 'reps' ? t.reps(target.reps)
    : target.metricType === 'duration' ? durationText(target.durationSeconds, language)
    : `${durationText(target.durationSeconds, language)}${hideDistance||target.distanceMeters === undefined ? '' : ` · ${t.meters(target.distanceMeters)}`}`;
  const relative=item.prescription?.safetyCue?` · ${item.prescription.loadDescription?.[language]??''} · ${item.prescription.safetyCue[language]}`:'';
  return `${t.sets(item.sets)} · ${value}${relative}`;
}

export {templateLabel} from '../../../i18n/features/plan/labels';
const dayOrder=['mon','tue','wed','thu','fri','sat','sun'] as const;
export function preferredDaysLabel(days:PlanVersion['preferredDays'],language:PlanLanguage):string{
 if(!days?.length)return '';
 const selected=dayOrder.filter(day=>days.includes(day));
 if(language==='zh'){
  const names:{[K in typeof dayOrder[number]]:string}={mon:'一',tue:'二',wed:'三',thu:'四',fri:'五',sat:'六',sun:'日'};
  return `周${selected.map(day=>names[day]).join('、')}`;
 }
 const names:{[K in typeof dayOrder[number]]:string}={mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
 return selected.map(day=>names[day]).join('/');
}
export function PlanPage({ version, currentVersionId, language, exerciseName, onVersions, onExercises, onExercise, onDiscuss }: PlanPageProps) {
  const t = planMessages[language], current = version.id === currentVersionId;
  const sourceCopy=language==='zh'?guideZh:guideEn;
  const source=[t.origins[version.origin],version.source==='local'?sourceCopy.basic:version.source==='ai'?sourceCopy.ai:''].filter(Boolean).join(' · ');
  return <section className="plan-page" aria-labelledby="plan-title">
    <header><h1 id="plan-title">{t.title}</h1>
      <p className="plan-muted">{t.version(version.versionNumber)} · <time dateTime={version.createdAt}>{new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(version.createdAt))}</time> · {source}{!current && ` · ${t.readOnly}`}</p>
    </header>
    <div className="plan-overview"><Sheet><dl className="plan-summary"><dt>{t.goal}</dt><dd>{version.goalText}</dd></dl></Sheet><Sheet><dl className="plan-summary"><dt>{t.rhythm}</dt><dd>{version.preferredDays?.length?preferredDaysLabel(version.preferredDays,language):language==='zh'?`每周 ${version.weeklyTarget} 次`:`${version.weeklyTarget} times a week`}</dd><dd className="plan-muted">{estimatedDurationLabel(version.templates,language)}</dd></dl></Sheet></div>
    {version.templates.map(template => <section className="plan-session" key={template.id} aria-label={templateLabel(template, language)}>
      <Row><h2>{templateLabel(template, language)}</h2><span className="plan-muted">{t.minutes(template.estimatedMinutes)}</span></Row>
      <div className="plan-items">{template.items.map((item, index) => <Chip key={`${item.exerciseId}-${index}`} selected={false}
        onClick={event => onExercise(version, template.id, index, event.currentTarget)}>{exerciseName(item.exerciseId)} · {itemTarget(item, language, item.exerciseId===EXERCISE_IDS.walking&&/室内|indoor/i.test(template.name))}</Chip>)}</div>
    </section>)}
    <nav className="plan-actions" aria-label={t.title}><Button onClick={onVersions}>{t.history}</Button><Button onClick={onExercises}>{t.library}</Button></nav>
    {current && onDiscuss && <Button variant="primary" onClick={() => { if (version.id === currentVersionId) onDiscuss(version); }}>{t.chat}</Button>}
  </section>;
}
