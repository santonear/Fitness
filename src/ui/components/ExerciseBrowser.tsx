import { useState, type ReactNode } from 'react';
import { searchExercises, suggestExercises, type ExerciseSearchFilters } from '../../catalog/catalog-service';
import { exerciseCautionAreas, getExerciseGuide } from '../../catalog/exercise-guide';
import { exerciseBodyPart } from '../../catalog/registry';
import { BODY_PARTS, equipmentLabel } from '../../catalog/taxonomy';
import { Button } from './common';
import { ChoiceChip } from './kit';
import {
  bodyParts,
  goals,
  machineEquipment,
  places,
  primaryEquipment,
  toggleSelection,
} from '../pages/training/manual/selection';
import { format } from '../mainline/context';
import zh from '../../i18n/features/manual/zh.json';
import en from '../../i18n/features/manual/en.json';
import '../pages/training/manual/manual.css';
export function ExerciseBrowser({
  locale,
  query,
  setQuery,
  filters,
  setFilters,
  selected = [],
  onSelect,
  onDetail,
  cautionAreas = [],
  prefilled = false,
  renderAction,
  rank,
}: {
  locale: 'zh' | 'en';
  query: string;
  setQuery: (value: string) => void;
  filters: ExerciseSearchFilters;
  setFilters: (value: ExerciseSearchFilters) => void;
  selected?: string[];
  onSelect: (id: string) => void;
  onDetail: (id: string, trigger: HTMLElement) => void;
  cautionAreas?: string[];
  prefilled?: boolean;
  renderAction?: (id: string) => ReactNode;
  rank?: (id: string) => number;
}) {
  const copy = locale === 'zh' ? zh : en;
  const [limit, setLimit] = useState(36);
  const equipment = filters.equipment?.some(key => (machineEquipment as readonly string[]).includes(key))
    ? filters.equipment.filter(key => key !== 'gym-machine')
    : filters.equipment;
  const searchFilters = { ...filters, equipment, cautionAreas };
  const results = searchExercises(query, searchFilters);
  const suggestions = results.length ? [] : suggestExercises(query, searchFilters);
  const shown = results.length ? results : suggestions;
  if (rank) shown.sort((a, b) => rank(b.id) - rank(a.id));
  const clearedCount = searchExercises('', { allowedIds: filters.allowedIds, cautionAreas }).length;
  function clearFilters() {
    setFilters({ allowedIds: filters.allowedIds });
    setQuery('');
    setLimit(36);
  }
  const label = (key: string) => copy[key as keyof typeof copy] ?? equipmentLabel(key, locale);
  function filterGroup(title: string, key: 'places' | 'equipment' | 'bodyParts' | 'goals', values: readonly string[]) {
    return (
      <fieldset className="manual-filter-group">
        <legend>{title}</legend>
        <div className="manual-chips">
          {values.map(value => (
            <ChoiceChip
              key={value}
              size="sm"
              selected={(filters[key] as readonly string[] | undefined)?.includes(value) ?? false}
              onClick={() => {
                setFilters({ ...filters, [key]: toggleSelection(filters[key] ?? [], value) });
                setLimit(36);
              }}
            >
              {label(value)}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <>
      <label className="manual-search">
        {copy.search}
        <input
          type="search"
          maxLength={40}
          value={query}
          placeholder={copy.searchHint}
          onChange={event => {
            setQuery(event.target.value);
            setLimit(36);
          }}
        />
      </label>
      <details className="manual-filters" open>
        <summary>{copy.filters}</summary>
        {prefilled && <p>{copy.prefill}</p>}
        {filterGroup(copy.place, 'places', places)}
        {filterGroup(copy.equipment, 'equipment', primaryEquipment)}
        {filters.equipment?.includes('gym-machine') && filterGroup(copy['gym-machine'], 'equipment', machineEquipment)}
        {filterGroup(copy.body, 'bodyParts', bodyParts)}
        {filterGroup(copy.goal, 'goals', goals)}
        {filters.goals?.includes('rehab') && <p role="note">{copy.rehabHint}</p>}
        {!!results.length && <Button onClick={clearFilters}>{copy.clear}</Button>}
      </details>
      <div className="manual-results-heading">
        <h2>{format(copy.results, { count: results.length })}</h2>
      </div>
      {!results.length && (
        <section className="manual-empty">
          <p>{copy.noMatch}</p>
          <p>{format(copy.clearCount, { count: clearedCount })}</p>
          <p>{copy.clearSearchHint}</p>
          <Button onClick={clearFilters}>{copy.clear}</Button>
        </section>
      )}
      {!!suggestions.length && <h2>{copy.similar}</h2>}
      <div className="manual-grid">
        {shown.slice(0, limit).map(exercise => {
          const guide = getExerciseGuide(exercise.id, locale);
          const body = exerciseBodyPart(exercise.id);
          const caution = exerciseCautionAreas(exercise.id).some(area => cautionAreas.includes(area));
          return (
            <article className="manual-card" key={exercise.id} data-selected={selected.includes(exercise.id)}>
              <button
                type="button"
                className="manual-pick"
                aria-pressed={selected.includes(exercise.id)}
                aria-label={exercise.name[locale]}
                onClick={() => onSelect(exercise.id)}
              >
                {guide.media ? (
                  <img src={guide.media.src} alt="" loading="lazy" />
                ) : (
                  <span className="manual-no-image" aria-hidden="true">
                    {copy.noImage}
                  </span>
                )}
                <span className="manual-card-copy">
                  <strong>{exercise.name[locale]}</strong>
                  <span>
                    {equipmentLabel(exercise.equipment, locale)} ·{' '}
                    {BODY_PARTS[body]?.[locale === 'zh' ? 0 : 1] ?? label(body)}
                  </span>
                </span>
                <span className="manual-check" aria-hidden="true">
                  {selected.includes(exercise.id) ? '✓' : '+'}
                </span>
              </button>
              {caution && <p className="manual-caution">{copy.caution}</p>}
              <Button
                onClick={event => {
                  onDetail(exercise.id, event.currentTarget);
                }}
              >
                {copy.details}
              </Button>
              {renderAction?.(exercise.id)}
            </article>
          );
        })}
      </div>
      {results.length > limit && <Button onClick={() => setLimit(value => value + 36)}>{copy.more}</Button>}
    </>
  );
}
