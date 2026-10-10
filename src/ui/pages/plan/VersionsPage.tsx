import type { PlanVersion } from '../../../domain/v8/contracts';
import { planMessages, type PlanLanguage } from '../../../i18n/features/plan/messages';
import { Button, Row } from '../../components/common';
import './plan.css';

export interface VersionsPageProps {
  versions: readonly PlanVersion[];
  currentVersionId: string;
  language: PlanLanguage;
  onBack: () => void;
  onView: (version: PlanVersion) => void;
}
export function VersionsPage({ versions, currentVersionId, language, onBack, onView }: VersionsPageProps) {
  const t = planMessages[language];
  const sorted = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.versionNumber - a.versionNumber);
  return <section className="plan-page" aria-labelledby="versions-title">
    <nav><Button onClick={onBack}>{t.back}</Button></nav>
    <header><h1 id="versions-title">{t.versions}</h1><p className="plan-muted">{t.historyNote}</p></header>
    <ol className="plan-timeline">{sorted.map(version => <li key={version.id}>
      <Row><h2>{t.version(version.versionNumber)} · {version.id === currentVersionId ? t.current : t.readOnly}</h2>
        <time className="plan-muted" dateTime={version.createdAt}>{new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(version.createdAt))}</time></Row>
      <p>{version.goalText}</p><p className="plan-muted">{t.origins[version.origin]}</p>
      <ul>{version.changeSummary.map((change, index) => <li key={index}>{change}</li>)}</ul>
      <Button onClick={() => onView(version)}>{t.view}</Button>
    </li>)}</ol>
  </section>;
}
