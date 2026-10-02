import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchExercises } from '../../catalog/catalog-service';
import type { CatalogFilters, Locale } from '../../domain/models';

export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CatalogFilters['category']>();
  const results = searchExercises(query, locale, { category });

  return (
    <>
      <h1>{t('exercises')}</h1>
      <div className="catalog-filters">
        <label>
          {t('catalogSearch')}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          {t('catalogCategory')}
          <select value={category ?? ''} onChange={(event) => setCategory(event.target.value as CatalogFilters['category'] || undefined)}>
            <option value="">{t('catalogAll')}</option>
            {(['strength', 'cardio', 'bodyweight'] as const).map((value) => (
              <option key={value} value={value}>{t(value)}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">{t('catalogUnits')}</p>
      {results.length === 0 && <p role="status">{t('catalogNoResults')}</p>}
      {results.map((exercise) => (
        <article key={exercise.id} className="catalog-exercise">
          <h2>{exercise.name[locale]}</h2>
          <p className="muted">{t(exercise.category)} · {t(`equipment_${exercise.equipment}`)} · {t(`metric_${exercise.metricType}`)}</p>
          <ol>{exercise.steps[locale].map((step) => <li key={step}>{step}</li>)}</ol>
          {exercise.cautions[locale].map((caution) => <p key={caution}>{caution}</p>)}
        </article>
      ))}
    </>
  );
}
