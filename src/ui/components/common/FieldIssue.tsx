import type { TextIssue } from '../../../domain/input-guard';
import { inputGuardCopy } from '../../../i18n/features/common/input-guard';
import './field-issue.css';

export function FieldIssue({
  id,
  issue,
  locale,
  max,
}: {
  id?: string;
  issue?: TextIssue;
  locale: 'zh' | 'en';
  max?: number;
}) {
  if (!issue) return null;
  return (
    <p id={id} className="v9-field-issue" role="alert">
      {inputGuardCopy[locale][issue].replace('{max}', String(max ?? ''))}
    </p>
  );
}
